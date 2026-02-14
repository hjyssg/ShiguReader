from __future__ import annotations

import asyncio
import hashlib
import logging
import subprocess
from pathlib import Path

from app.constants import (
    ARCHIVE_SUFFIXES,
    AUDIO_SUFFIXES,
    IMAGE_SUFFIXES,
    VIDEO_SUFFIXES,
)
from app.core.config import settings
from app.file_processing._archive_backend import archive_kind, list_entries
from app.file_processing.thumbnail_generator import (
    generate_first_image_thumbnail,
    generate_image_thumbnail,
    generate_video_placeholder,
    generate_video_thumbnail,
)
from app.index_db.db import get_index_session
from app.index_db.repository import IndexRepository

logger = logging.getLogger(__name__)


class ThumbService:
    """Singleton service for thumbnail generation with inflight deduplication and concurrency control."""

    _instance: ThumbService | None = None
    _lock = asyncio.Lock()

    def __init__(self) -> None:
        self._semaphore = asyncio.Semaphore(settings.THUMB_CONCURRENCY)
        self._inflight: dict[str, asyncio.Future[Path]] = {}
        self._cache_dir = Path(settings.THUMB_CACHE_DIR).resolve()
        self._cache_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    async def get_instance(cls) -> ThumbService:
        if cls._instance is None:
            async with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def _get_cache_path(self, filepath: Path) -> Path:
        """Generate cache path based on filepath hash and fingerprint."""
        stat = filepath.stat()
        fingerprint = f"{filepath.name}-{stat.st_size}-{int(stat.st_mtime)}"
        path_hash = hashlib.sha256(str(filepath.resolve()).encode()).hexdigest()
        
        cache_subdir = self._cache_dir / path_hash[:2] / path_hash[2:]
        cache_subdir.mkdir(parents=True, exist_ok=True)
        
        return cache_subdir / f"{hashlib.md5(fingerprint.encode()).hexdigest()}.jpg"

    async def get_or_generate(self, filepath: Path, *, force: bool = False) -> Path:
        """Get cached thumbnail or generate new one with inflight deduplication."""
        cache_path = self._get_cache_path(filepath)

        if force and cache_path.exists():
            cache_path.unlink(missing_ok=True)

        if cache_path.exists():
            logger.info(f"Thumbnail cache hit: {filepath}")
            return cache_path

        # 尝试通过 fingerprint 查找已有的缩略图
        stat = filepath.stat()
        fingerprint = f"{filepath.name}-{stat.st_size}-{int(stat.st_mtime)}"
        try:
            with get_index_session() as session:
                repo = IndexRepository(session)
                existing_thumb = repo.find_thumbnail_by_fingerprint(fingerprint)
                if existing_thumb:
                    existing_thumb_path = Path(existing_thumb)
                    if existing_thumb_path.exists():
                        logger.info(f"Thumbnail found by fingerprint: {filepath} -> {existing_thumb_path}")
                        # 复制缩略图到当前文件的缓存路径
                        import shutil
                        cache_path.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(existing_thumb_path, cache_path)
                        # 更新数据库中的缩略图路径
                        repo.update_file_thumbnail(str(filepath), str(cache_path))
                        return cache_path
        except Exception as e:
            logger.warning(f"Failed to find thumbnail by fingerprint: {filepath}, error: {e}")

        key = str(filepath.resolve())
        
        if key in self._inflight:
            logger.info(f"Thumbnail generation in-flight, waiting: {filepath}")
            return await self._inflight[key]

        future: asyncio.Future[Path] = asyncio.Future()
        self._inflight[key] = future

        try:
            result = await asyncio.wait_for(
                self._generate_with_semaphore(filepath, cache_path),
                timeout=settings.THUMB_TIMEOUT_SEC,
            )
            future.set_result(result)
            return result
        except asyncio.TimeoutError:
            logger.error(f"Thumbnail generation timeout: {filepath}")
            future.set_exception(TimeoutError(f"Thumbnail generation timeout: {filepath}"))
            raise
        except Exception as e:
            logger.error(f"Thumbnail generation failed: {filepath}, error: {e}")
            future.set_exception(e)
            raise
        finally:
            self._inflight.pop(key, None)

    async def _generate_with_semaphore(self, filepath: Path, cache_path: Path) -> Path:
        """Generate thumbnail with semaphore concurrency control."""
        async with self._semaphore:
            logger.info(f"Thumbnail generation started: {filepath}")
            await asyncio.to_thread(self._generate_sync, filepath, cache_path)
            logger.info(f"Thumbnail generation completed: {filepath}")
            return cache_path

    def _generate_sync(self, filepath: Path, cache_path: Path) -> None:
        """Synchronous thumbnail generation logic."""
        suffix = filepath.suffix.lower()

        if suffix in ARCHIVE_SUFFIXES:
            self._generate_archive_thumb(filepath, cache_path)
        elif suffix in VIDEO_SUFFIXES:
            self._generate_video_thumb(filepath, cache_path)
        elif suffix in IMAGE_SUFFIXES:
            self._generate_image_thumb(filepath, cache_path)
        else:
            raise ValueError(f"Unsupported file type: {suffix}")

    def _generate_archive_thumb(self, filepath: Path, cache_path: Path) -> None:
        """Generate thumbnail from archive with enhanced cover selection."""
        try:
            entries = sorted(list_entries(filepath))
            
            # Count file types
            image_count = 0
            video_count = 0
            music_count = 0
            
            for entry in entries:
                suffix = Path(entry).suffix.lower()
                if suffix in IMAGE_SUFFIXES:
                    image_count += 1
                elif suffix in VIDEO_SUFFIXES:
                    video_count += 1
                elif suffix in AUDIO_SUFFIXES:
                    music_count += 1
            
            # Priority 1: cover.* files
            cover_entry = next(
                (e for e in entries if Path(e).stem.lower() == "cover" and e.lower().endswith(IMAGE_SUFFIXES)),
                None,
            )
            
            # Priority 2: files starting with 000 or 001
            if not cover_entry:
                cover_entry = next(
                    (e for e in entries if Path(e).stem.startswith(("000", "001")) and e.lower().endswith(IMAGE_SUFFIXES)),
                    None,
                )
            
            # Priority 3: first image file
            if not cover_entry:
                cover_entry = next(
                    (e for e in entries if e.lower().endswith(IMAGE_SUFFIXES)),
                    None,
                )
            
            if not cover_entry:
                raise FileNotFoundError(f"No image found in archive: {filepath}")

            # Use existing thumbnail generator
            generate_first_image_thumbnail(
                filepath,
                cache_path,
                height=settings.THUMB_HEIGHT,
            )
            
            # Save archive metadata to DB
            try:
                arch_type = archive_kind(filepath)
                with get_index_session() as session:
                    repo = IndexRepository(session)
                    repo.upsert_archive_meta(
                        filepath=str(filepath),
                        archive_type=arch_type,
                        entry_count=len(entries),
                        image_file_num=image_count,
                        video_file_num=video_count,
                        music_file_num=music_count,
                    )
                    # Update thumbnail path
                    repo.update_file_thumbnail(str(filepath), str(cache_path))
                logger.info(f"Archive metadata saved to DB: {filepath}")
            except Exception as db_err:
                logger.warning(f"Failed to save archive metadata to DB: {filepath}, error: {db_err}")
        except Exception as e:
            logger.error(f"Archive thumbnail generation failed: {filepath}, error: {e}")
            raise

    def _generate_video_thumb(self, filepath: Path, cache_path: Path) -> None:
        """Generate video thumbnail using ffmpeg with fallback to JPEG placeholder."""
        try:
            generate_video_thumbnail(filepath, cache_path, timeout=settings.THUMB_TIMEOUT_SEC)
        except (FileNotFoundError, subprocess.TimeoutExpired, RuntimeError) as e:
            logger.warning(f"Video thumbnail generation failed, using JPEG placeholder: {filepath}, error: {e}")
            generate_video_placeholder(cache_path)

    def _generate_image_thumb(self, filepath: Path, cache_path: Path) -> None:
        """Generate thumbnail from image file."""
        try:
            generate_image_thumbnail(filepath, cache_path, height=settings.THUMB_HEIGHT)
        except Exception as e:
            logger.error(f"Image thumbnail generation failed: {filepath}, error: {e}")
            raise
