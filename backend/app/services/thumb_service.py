from __future__ import annotations

import asyncio
import hashlib
import logging
import subprocess
from pathlib import Path

from PIL import Image, ImageOps

from app.core.config import settings
from app.file_processing._archive_backend import archive_kind, list_entries
from app.file_processing.thumbnail_generator.service import (
    IMAGE_SUFFIXES,
    generate_first_image_thumbnail,
)
from app.index_db.db import get_index_session
from app.index_db.repository import IndexRepository

logger = logging.getLogger(__name__)

VIDEO_SUFFIXES = (".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv")
IMAGE_DIRECT_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".heic")
ARCHIVE_SUFFIXES = (".zip", ".cbz", ".rar", ".cbr", ".7z", ".tar", ".tar.gz", ".tgz")


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
        
        return cache_subdir / f"{hashlib.md5(fingerprint.encode()).hexdigest()}.webp"

    async def get_or_generate(self, filepath: Path) -> Path:
        """Get cached thumbnail or generate new one with inflight deduplication."""
        cache_path = self._get_cache_path(filepath)
        
        if cache_path.exists():
            logger.info(f"Thumbnail cache hit: {filepath}")
            return cache_path

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
        elif suffix in IMAGE_DIRECT_SUFFIXES:
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
                if suffix in IMAGE_SUFFIXES or suffix in (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"):
                    image_count += 1
                elif suffix in VIDEO_SUFFIXES:
                    video_count += 1
                elif suffix in (".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a"):
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
        """Generate video thumbnail using ffmpeg with multiple fallback strategies."""
        attempts = [
            [
                "ffmpeg",
                "-y",
                "-i",
                str(filepath),
                "-vf",
                "select=eq(n\\,1)",
                "-vframes",
                "1",
                str(cache_path),
            ],
            [
                "ffmpeg",
                "-y",
                "-i",
                str(filepath),
                "-vf",
                "select=eq(n\\,0)",
                "-vframes",
                "1",
                str(cache_path),
            ],
            [
                "ffmpeg",
                "-y",
                "-ss",
                "00:00:00",
                "-i",
                str(filepath),
                "-frames:v",
                "1",
                str(cache_path),
            ],
        ]

        last_err = ""
        for command in attempts:
            try:
                result = subprocess.run(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=False,
                    text=True,
                    encoding="utf-8",
                    errors="ignore",
                    timeout=settings.THUMB_TIMEOUT_SEC,
                )
                
                if cache_path.exists() and cache_path.stat().st_size > 0:
                    return
                
                if result.stderr:
                    last_err = result.stderr.strip()
            except FileNotFoundError:
                last_err = "ffmpeg not found"
                break
            except subprocess.TimeoutExpired:
                last_err = "ffmpeg timeout"
                break

        # Fallback: generate SVG placeholder
        logger.warning(f"Video thumbnail generation failed, using SVG placeholder: {filepath}, error: {last_err[:200]}")
        self._generate_svg_placeholder(cache_path)

    def _generate_svg_placeholder(self, cache_path: Path) -> None:
        """Generate SVG placeholder for video files."""
        svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#1a1a1a"/>
  <circle cx="200" cy="150" r="40" fill="#ffffff" opacity="0.8"/>
  <polygon points="190,135 190,165 215,150" fill="#1a1a1a"/>
  <text x="200" y="200" font-family="Arial" font-size="14" fill="#ffffff" text-anchor="middle" opacity="0.6">Video</text>
</svg>'''
        cache_path.write_text(svg_content, encoding="utf-8")

    def _generate_image_thumb(self, filepath: Path, cache_path: Path) -> None:
        """Generate thumbnail from image file."""
        try:
            with Image.open(filepath) as img_raw:
                img = ImageOps.exif_transpose(img_raw)
                
                # Handle transparency
                if img.mode in ("RGBA", "LA"):
                    rgba = img.convert("RGBA")
                    background = Image.new("RGB", rgba.size, (255, 255, 255))
                    background.paste(rgba, mask=rgba.split()[-1])
                    img = background
                elif img.mode == "P":
                    if "transparency" in img.info:
                        rgba = img.convert("RGBA")
                        background = Image.new("RGB", rgba.size, (255, 255, 255))
                        background.paste(rgba, mask=rgba.split()[-1])
                        img = background
                    else:
                        img = img.convert("RGB")
                elif img.mode != "RGB":
                    img = img.convert("RGB")

                # Resize maintaining aspect ratio
                img.thumbnail((400, settings.THUMB_HEIGHT))
                img.save(cache_path, "WEBP", quality=85, optimize=True)
        except Exception as e:
            logger.error(f"Image thumbnail generation failed: {filepath}, error: {e}")
            raise
