from __future__ import annotations

from dataclasses import dataclass
from time import time
from typing import Iterator, TypeVar

from sqlmodel import Session, func, select

from app.index_db.db import index_write_guard
from app.index_db.confidence import SCAN_FRESH_WINDOW_SEC
from app.index_db.models import (
    ArchiveMeta,
    Artist,
    File,
    FileArtist,
    FileTag,
    Folder,
    ParsedMetadata,
    Progress,
    Tag,
)


def _now_ts() -> int:
    return int(time())


T = TypeVar("T")


def _iter_chunks(items: list[T], chunk_size: int) -> Iterator[list[T]]:
    if chunk_size <= 0:
        chunk_size = 500
    for i in range(0, len(items), chunk_size):
        yield items[i : i + chunk_size]


@dataclass(slots=True)
class UpsertFolderInput:
    filepath: str
    dirname: str
    mtime: int | None = None
    scan_state: int = 1
    watch_state: int = 0
    scanned: bool = False


@dataclass(slots=True)
class UpsertFileInput:
    filepath: str
    filename: str
    mtime: int
    filesize: int
    fingerprint: str
    folderpath: str | None = None
    file_type: str = "unknown"
    ext: str | None = None
    thumbnail_filepath: str | None = None
    content_hash: str | None = None
    scan_state: int = 1
    watch_state: int = 0
    scanned: bool = False


class IndexRepository:
    def _apply_presence_filter(self, stmt, presence_filter: str):
        if presence_filter == "watched":
            return stmt.where(File.watch_state == 1)

        if presence_filter == "scanned_recent":
            cutoff = _now_ts() - SCAN_FRESH_WINDOW_SEC
            return stmt.where(File.scan_state == 1).where(File.last_seen_at >= cutoff)

        return stmt

    def __init__(self, session: Session) -> None:
        self.session = session

    def _commit(self) -> None:
        with index_write_guard():
            self.session.commit()

    def upsert_folder(self, data: UpsertFolderInput) -> Folder:
        now = _now_ts()
        folder = self.session.get(Folder, data.filepath)
        if folder is None:
            folder = Folder(
                filepath=data.filepath,
                dirname=data.dirname,
                mtime=data.mtime,
                scan_state=data.scan_state,
                watch_state=data.watch_state,
                first_seen_at=now if data.scan_state == 1 else None,
                last_seen_at=now if data.scan_state == 1 else None,
                last_scanned_at=now if data.scanned else None,
            )
            self.session.add(folder)
            self._commit()
            self.session.refresh(folder)
            return folder

        folder.dirname = data.dirname
        folder.mtime = data.mtime
        folder.scan_state = data.scan_state
        folder.watch_state = data.watch_state
        if data.scan_state == 1:
            if folder.first_seen_at is None:
                folder.first_seen_at = now
            folder.last_seen_at = now
        if data.scanned:
            folder.last_scanned_at = now

        self.session.add(folder)
        self._commit()
        self.session.refresh(folder)
        return folder

    def upsert_file(self, data: UpsertFileInput) -> File:
        now = _now_ts()
        file = self.session.get(File, data.filepath)
        if file is None:
            file = File(
                filepath=data.filepath,
                folderpath=data.folderpath,
                filename=data.filename,
                mtime=data.mtime,
                filesize=data.filesize,
                file_type=data.file_type,
                ext=data.ext,
                thumbnail_filepath=data.thumbnail_filepath,
                fingerprint=data.fingerprint,
                content_hash=data.content_hash,
                scan_state=data.scan_state,
                watch_state=data.watch_state,
                first_seen_at=now if data.scan_state == 1 else None,
                last_seen_at=now if data.scan_state == 1 else None,
                last_scanned_at=now if data.scanned else None,
            )
            self.session.add(file)
            self._commit()
            self.session.refresh(file)
            return file

        file.folderpath = data.folderpath
        file.filename = data.filename
        file.mtime = data.mtime
        file.filesize = data.filesize
        file.file_type = data.file_type
        file.ext = data.ext
        file.thumbnail_filepath = data.thumbnail_filepath
        file.fingerprint = data.fingerprint
        file.content_hash = data.content_hash
        file.scan_state = data.scan_state
        file.watch_state = data.watch_state
        if data.scan_state == 1:
            if file.first_seen_at is None:
                file.first_seen_at = now
            file.last_seen_at = now
        if data.scanned:
            file.last_scanned_at = now

        self.session.add(file)
        self._commit()
        self.session.refresh(file)
        return file

    def batch_upsert_folders(self, data_list: list[UpsertFolderInput], batch_size: int = 500) -> None:
        """Batch upsert folders for better performance."""
        if not data_list:
            return

        now = _now_ts()
        for chunk in _iter_chunks(data_list, batch_size):
            filepaths = [d.filepath for d in chunk]

            # Query existing folders
            stmt = select(Folder).where(Folder.filepath.in_(filepaths))
            existing = {f.filepath: f for f in self.session.exec(stmt).all()}

            to_add = []
            for data in chunk:
                folder = existing.get(data.filepath)
                if folder is None:
                    # Create new
                    folder = Folder(
                        filepath=data.filepath,
                        dirname=data.dirname,
                        mtime=data.mtime,
                        scan_state=data.scan_state,
                        watch_state=data.watch_state,
                        first_seen_at=now if data.scan_state == 1 else None,
                        last_seen_at=now if data.scan_state == 1 else None,
                        last_scanned_at=now if data.scanned else None,
                    )
                    to_add.append(folder)
                else:
                    # Update existing
                    folder.dirname = data.dirname
                    folder.mtime = data.mtime
                    folder.scan_state = data.scan_state
                    folder.watch_state = data.watch_state
                    if data.scan_state == 1:
                        if folder.first_seen_at is None:
                            folder.first_seen_at = now
                        folder.last_seen_at = now
                    if data.scanned:
                        folder.last_scanned_at = now

            if to_add:
                self.session.add_all(to_add)
            self._commit()

    def batch_upsert_files(self, data_list: list[UpsertFileInput], batch_size: int = 500) -> None:
        """Batch upsert files for better performance."""
        if not data_list:
            return

        now = _now_ts()
        for chunk in _iter_chunks(data_list, batch_size):
            filepaths = [d.filepath for d in chunk]

            # Query existing files
            stmt = select(File).where(File.filepath.in_(filepaths))
            existing = {f.filepath: f for f in self.session.exec(stmt).all()}

            to_add = []
            for data in chunk:
                file = existing.get(data.filepath)
                if file is None:
                    # Create new
                    file = File(
                        filepath=data.filepath,
                        folderpath=data.folderpath,
                        filename=data.filename,
                        mtime=data.mtime,
                        filesize=data.filesize,
                        file_type=data.file_type,
                        ext=data.ext,
                        thumbnail_filepath=data.thumbnail_filepath,
                        fingerprint=data.fingerprint,
                        content_hash=data.content_hash,
                        scan_state=data.scan_state,
                        watch_state=data.watch_state,
                        first_seen_at=now if data.scan_state == 1 else None,
                        last_seen_at=now if data.scan_state == 1 else None,
                        last_scanned_at=now if data.scanned else None,
                    )
                    to_add.append(file)
                else:
                    # Update existing
                    file.folderpath = data.folderpath
                    file.filename = data.filename
                    file.mtime = data.mtime
                    file.filesize = data.filesize
                    file.file_type = data.file_type
                    file.ext = data.ext
                    file.thumbnail_filepath = data.thumbnail_filepath
                    file.fingerprint = data.fingerprint
                    file.content_hash = data.content_hash
                    file.scan_state = data.scan_state
                    file.watch_state = data.watch_state
                    if data.scan_state == 1:
                        if file.first_seen_at is None:
                            file.first_seen_at = now
                        file.last_seen_at = now
                    if data.scanned:
                        file.last_scanned_at = now

            if to_add:
                self.session.add_all(to_add)
            self._commit()

    def upsert_archive_meta(
        self,
        filepath: str,
        archive_type: str,
        entry_count: int,
        image_file_num: int,
        video_file_num: int,
        music_file_num: int,
    ) -> ArchiveMeta:
        """Upsert archive metadata."""
        now = _now_ts()
        meta = self.session.get(ArchiveMeta, filepath)
        if meta is None:
            meta = ArchiveMeta(
                filepath=filepath,
                archive_type=archive_type,
                entry_count=entry_count,
                image_file_num=image_file_num,
                video_file_num=video_file_num,
                music_file_num=music_file_num,
                scanned_at=now,
            )
            self.session.add(meta)
        else:
            meta.archive_type = archive_type
            meta.entry_count = entry_count
            meta.image_file_num = image_file_num
            meta.video_file_num = video_file_num
            meta.music_file_num = music_file_num
            meta.scanned_at = now

        self._commit()
        self.session.refresh(meta)
        return meta

    def upsert_progress(
        self,
        *,
        filepath: str,
        filename: str | None = None,
        file_type: str | None = None,
        filesize: int | None = None,
        mtime: int | None = None,
        thumbnail_url: str | None = None,
        page_current: int | None = None,
        page_total: int | None = None,
        position_sec: float | None = None,
        duration_sec: float | None = None,
    ) -> Progress:
        now = _now_ts()
        progress = self.session.get(Progress, filepath)
        if progress is None:
            progress = Progress(
                filepath=filepath,
                filename=filename,
                file_type=file_type,
                filesize=filesize,
                mtime=mtime,
                thumbnail_url=thumbnail_url,
                last_opened_at=now,
                page_current=page_current,
                page_total=page_total,
                position_sec=position_sec,
                duration_sec=duration_sec,
                updated_at=now,
            )
            self.session.add(progress)
            self._commit()
            self.session.refresh(progress)
            return progress

        progress.last_opened_at = now
        progress.updated_at = now
        progress.filename = filename or progress.filename
        progress.file_type = file_type or progress.file_type
        progress.filesize = filesize if filesize is not None else progress.filesize
        progress.mtime = mtime if mtime is not None else progress.mtime
        progress.thumbnail_url = thumbnail_url or progress.thumbnail_url
        progress.page_current = page_current
        progress.page_total = page_total
        progress.position_sec = position_sec
        progress.duration_sec = duration_sec

        self.session.add(progress)
        self._commit()
        self.session.refresh(progress)
        return progress

    def list_progress_history(
        self,
        *,
        offset: int,
        limit: int,
        sort_order: str = "desc",
    ) -> list[Progress]:
        order_clause = (
            Progress.last_opened_at.asc()
            if sort_order == "asc"
            else Progress.last_opened_at.desc()
        )
        stmt = select(Progress).order_by(order_clause).offset(offset).limit(limit)
        return list(self.session.exec(stmt).all())

    def count_progress_history(self) -> int:
        stmt = select(func.count()).select_from(Progress)
        return int(self.session.exec(stmt).one())

    def update_file_thumbnail(self, filepath: str, thumbnail_filepath: str) -> None:
        """Update thumbnail path for a file."""
        file = self.session.get(File, filepath)
        if file is not None:
            file.thumbnail_filepath = thumbnail_filepath
            self._commit()

    def get_file(self, filepath: str) -> File | None:
        """Get a file row by filepath."""
        return self.session.get(File, filepath)

    def get_archive_meta(self, filepath: str) -> ArchiveMeta | None:
        """Get archive metadata row by filepath."""
        return self.session.get(ArchiveMeta, filepath)

    def find_thumbnail_by_fingerprint(self, fingerprint: str) -> str | None:
        """通过 fingerprint 查找已有的缩略图路径。"""
        stmt = (
            select(File.thumbnail_filepath)
            .where(File.fingerprint == fingerprint)
            .where(File.thumbnail_filepath.isnot(None))
            .limit(1)
        )
        result = self.session.exec(stmt).first()
        return result

    # ------------------------------------------------------------------
    # Parsed metadata helpers
    # ------------------------------------------------------------------

    def save_parse_result(
        self,
        filepath: str,
        *,
        title: str | None = None,
        authors: list[str] | None = None,
        cosers: list[str] | None = None,
        group_name: str | None = None,
        raw_tags: list[str] | None = None,
        event: str | None = None,
        date_tag: str | None = None,
        media_type: str | None = None,
    ) -> ParsedMetadata:
        """Persist a single parse result into parsed_metadata, artists, tags
        and their join tables."""
        now = _now_ts()

        # 业务约束：author(漫画作者) 与 coser(三次元) 不应出现在同一 zip。
        if cosers:
            authors = []

        # Upsert ParsedMetadata
        meta = self.session.get(ParsedMetadata, filepath)
        if meta is None:
            meta = ParsedMetadata(
                filepath=filepath,
                title=title,
                group_name=group_name,
                event=event,
                date_tag=date_tag,
                media_type=media_type,
                parsed_at=now,
            )
            self.session.add(meta)
        else:
            meta.title = title
            meta.group_name = group_name
            meta.event = event
            meta.date_tag = date_tag
            meta.media_type = media_type
            meta.parsed_at = now

        # Upsert artists + file_artists
        if authors:
            for author_name in authors:
                if not self.session.get(Artist, author_name):
                    self.session.add(Artist(artist_name=author_name))
                fa_key = (filepath, author_name, "")
                if not self.session.get(FileArtist, fa_key):
                    self.session.add(
                        FileArtist(filepath=filepath, artist_name=author_name)
                    )

        if cosers:
            for coser_name in cosers:
                if not self.session.get(Artist, coser_name):
                    self.session.add(Artist(artist_name=coser_name))
                fc_key = (filepath, coser_name, "coser")
                if not self.session.get(FileArtist, fc_key):
                    self.session.add(
                        FileArtist(filepath=filepath, artist_name=coser_name, role="coser")
                    )

        # Upsert tags + file_tags
        if raw_tags:
            for tag_name in raw_tags:
                if not self.session.get(Tag, tag_name):
                    self.session.add(Tag(tag_name=tag_name))
                ft_key = (filepath, tag_name)
                if not self.session.get(FileTag, ft_key):
                    self.session.add(FileTag(filepath=filepath, tag_name=tag_name))

        self._commit()
        self.session.refresh(meta)
        return meta

    def batch_save_parse_results(
        self,
        results: list[dict],
        batch_size: int = 500,
    ) -> None:
        """Batch persist parse results.

        Each dict in *results* must have a ``filepath`` key and may contain:
        ``title``, ``authors``, ``cosers``, ``group_name``, ``raw_tags``, ``event``,
        ``date_tag``, ``media_type``.
        """
        if not results:
            return

        for chunk in _iter_chunks(results, batch_size):
            self._batch_save_parse_results_chunk(chunk)

    def _batch_save_parse_results_chunk(self, results: list[dict]) -> None:
        """Persist one chunk of parse results."""
        now = _now_ts()
        filepaths = [r["filepath"] for r in results]

        # Ensure file FK exists. Parse payload should point to existing files,
        # but we guard against out-of-order calls or stale payloads.
        existing_files_stmt = select(File.filepath).where(File.filepath.in_(filepaths))
        existing_files = set(self.session.exec(existing_files_stmt).all())
        if not existing_files:
            return

        # Fetch existing metadata
        stmt = select(ParsedMetadata).where(ParsedMetadata.filepath.in_(filepaths))
        existing_meta = {
            m.filepath: m for m in self.session.exec(stmt).all()
        }

        # Collect all unique artist / tag names
        all_authors: set[str] = set()
        all_cosers: set[str] = set()
        all_tags: set[str] = set()
        for r in results:
            if r["filepath"] not in existing_files:
                continue
            row_cosers = {c for c in (r.get("cosers") or []) if c}
            row_authors = set() if row_cosers else {a for a in (r.get("authors") or []) if a}
            all_authors.update(row_authors)
            all_cosers.update(row_cosers)
            all_tags.update({t for t in (r.get("raw_tags") or []) if t})

        all_artists = all_authors | all_cosers

        # Fetch existing artists / tags
        existing_artists: set[str] = set()
        if all_artists:
            stmt_a = select(Artist.artist_name).where(
                Artist.artist_name.in_(list(all_artists))
            )
            existing_artists = set(self.session.exec(stmt_a).all())

        existing_tags: set[str] = set()
        if all_tags:
            stmt_t = select(Tag.tag_name).where(
                Tag.tag_name.in_(list(all_tags))
            )
            existing_tags = set(self.session.exec(stmt_t).all())

        to_add: list[object] = []

        for r in results:
            fp = r["filepath"]
            if fp not in existing_files:
                continue

            meta = existing_meta.get(fp)
            if meta is None:
                meta = ParsedMetadata(
                    filepath=fp,
                    title=r.get("title"),
                    group_name=r.get("group_name"),
                    event=r.get("event"),
                    date_tag=r.get("date_tag"),
                    media_type=r.get("media_type"),
                    parsed_at=now,
                )
                to_add.append(meta)
            else:
                meta.title = r.get("title")
                meta.group_name = r.get("group_name")
                meta.event = r.get("event")
                meta.date_tag = r.get("date_tag")
                meta.media_type = r.get("media_type")
                meta.parsed_at = now

            # Artists (dedupe within each file)
            row_cosers = {c for c in (r.get("cosers") or []) if c}
            row_authors = set() if row_cosers else {a for a in (r.get("authors") or []) if a}

            for name in row_authors:
                if name not in existing_artists:
                    to_add.append(Artist(artist_name=name))
                    existing_artists.add(name)

            for name in row_cosers:
                if name not in existing_artists:
                    to_add.append(Artist(artist_name=name))
                    existing_artists.add(name)

            # Tags (dedupe within each file)
            for tag in {t for t in (r.get("raw_tags") or []) if t}:
                if tag not in existing_tags:
                    to_add.append(Tag(tag_name=tag))
                    existing_tags.add(tag)

        if to_add:
            self.session.add_all(to_add)
        # First commit ParsedMetadata + master tables (artists/tags), then write
        # join tables. This avoids intermittent FK failures under bulk flush.
        self._commit()

        target_filepaths = [fp for fp in filepaths if fp in existing_files]

        existing_file_artists = {
            (fa.filepath, fa.artist_name, fa.role)
            for fa in self.session.exec(
                select(FileArtist).where(FileArtist.filepath.in_(target_filepaths))
            ).all()
        }
        existing_file_tags = {
            (ft.filepath, ft.tag_name)
            for ft in self.session.exec(
                select(FileTag).where(FileTag.filepath.in_(target_filepaths))
            ).all()
        }

        link_to_add: list[object] = []
        for r in results:
            fp = r["filepath"]
            if fp not in existing_files:
                continue

            row_cosers = {c for c in (r.get("cosers") or []) if c}
            row_authors = set() if row_cosers else {a for a in (r.get("authors") or []) if a}

            for name in row_authors:
                key = (fp, name, "")
                if key not in existing_file_artists:
                    link_to_add.append(FileArtist(filepath=fp, artist_name=name))
                    existing_file_artists.add(key)

            for name in row_cosers:
                key = (fp, name, "coser")
                if key not in existing_file_artists:
                    link_to_add.append(FileArtist(filepath=fp, artist_name=name, role="coser"))
                    existing_file_artists.add(key)

            for tag in {t for t in (r.get("raw_tags") or []) if t}:
                key = (fp, tag)
                if key not in existing_file_tags:
                    link_to_add.append(FileTag(filepath=fp, tag_name=tag))
                    existing_file_tags.add(key)

        if link_to_add:
            self.session.add_all(link_to_add)
            self._commit()

    def get_parsed_metadata(self, filepath: str) -> ParsedMetadata | None:
        """Return parsed metadata for a single file."""
        return self.session.get(ParsedMetadata, filepath)

    def get_file_artists(self, filepath: str) -> list[str]:
        """Return artist names associated with a file."""
        stmt = select(FileArtist.artist_name).where(
            FileArtist.filepath == filepath,
            FileArtist.role == "",
        )
        return list(self.session.exec(stmt).all())

    def get_file_cosers(self, filepath: str) -> list[str]:
        """Return coser names associated with a file."""
        stmt = select(FileArtist.artist_name).where(
            FileArtist.filepath == filepath,
            FileArtist.role == "coser",
        )
        return list(self.session.exec(stmt).all())

    def get_file_tags(self, filepath: str) -> list[str]:
        """Return tag names associated with a file."""
        stmt = select(FileTag.tag_name).where(FileTag.filepath == filepath)
        return list(self.session.exec(stmt).all())

    # ------------------------------------------------------------------
    # Search helpers
    # ------------------------------------------------------------------

    def search_files(self, q: str, mode: str = "hybrid", presence_filter: str = "all") -> list[File]:
        """Search files by filename/filepath."""
        if not q:
            return []

        if mode == "exact":
            stmt = select(File).where(
                (File.filename.contains(q)) | (File.filepath.contains(q))
            )
        else:
            stmt = select(File).where(
                (File.filename.ilike(f"%{q}%")) | (File.filepath.ilike(f"%{q}%"))
            )
        stmt = self._apply_presence_filter(stmt, presence_filter)
        return list(self.session.exec(stmt).all())

    def search_by_author(self, q: str, mode: str = "hybrid", presence_filter: str = "all") -> list[File]:
        """Search files by author name."""
        if not q:
            return []

        artist_stmt = select(Artist.artist_name)
        if mode == "exact":
            artist_stmt = artist_stmt.where(Artist.artist_name.contains(q))
        else:
            artist_stmt = artist_stmt.where(Artist.artist_name.ilike(f"%{q}%"))

        artist_names = list(self.session.exec(artist_stmt).all())
        if not artist_names:
            return []

        filepaths_stmt = select(FileArtist.filepath).where(
            FileArtist.artist_name.in_(artist_names),
            FileArtist.role == "",
        )
        filepaths = list(self.session.exec(filepaths_stmt).all())
        if not filepaths:
            return []

        files_stmt = select(File).where(File.filepath.in_(filepaths))
        files_stmt = self._apply_presence_filter(files_stmt, presence_filter)
        return list(self.session.exec(files_stmt).all())

    def search_by_coser(self, q: str, mode: str = "hybrid", presence_filter: str = "all") -> list[File]:
        """Search files by coser name."""
        if not q:
            return []

        artist_stmt = select(Artist.artist_name)
        if mode == "exact":
            artist_stmt = artist_stmt.where(Artist.artist_name.contains(q))
        else:
            artist_stmt = artist_stmt.where(Artist.artist_name.ilike(f"%{q}%"))

        artist_names = list(self.session.exec(artist_stmt).all())
        if not artist_names:
            return []

        filepaths_stmt = select(FileArtist.filepath).where(
            FileArtist.artist_name.in_(artist_names),
            FileArtist.role == "coser",
        )
        filepaths = list(self.session.exec(filepaths_stmt).all())
        if not filepaths:
            return []

        files_stmt = select(File).where(File.filepath.in_(filepaths))
        files_stmt = self._apply_presence_filter(files_stmt, presence_filter)
        return list(self.session.exec(files_stmt).all())

    def search_by_tag(self, q: str, mode: str = "hybrid", presence_filter: str = "all") -> list[File]:
        """Search files by tag name."""
        if not q:
            return []

        tag_stmt = select(Tag.tag_name)
        if mode == "exact":
            tag_stmt = tag_stmt.where(Tag.tag_name.contains(q))
        else:
            tag_stmt = tag_stmt.where(Tag.tag_name.ilike(f"%{q}%"))

        tag_names = list(self.session.exec(tag_stmt).all())
        if not tag_names:
            return []

        filepaths_stmt = select(FileTag.filepath).where(FileTag.tag_name.in_(tag_names))
        filepaths = list(self.session.exec(filepaths_stmt).all())
        if not filepaths:
            return []

        files_stmt = select(File).where(File.filepath.in_(filepaths))
        files_stmt = self._apply_presence_filter(files_stmt, presence_filter)
        return list(self.session.exec(files_stmt).all())

    # ------------------------------------------------------------------
    # Path maintenance helpers
    # ------------------------------------------------------------------

    def delete_file(self, filepath: str) -> None:
        file = self.session.get(File, filepath)
        if file is None:
            return
        self.session.delete(file)
        self._commit()

    def delete_paths_by_prefix(self, prefix: str) -> None:
        files_stmt = select(File).where(File.filepath.startswith(prefix))
        for file in self.session.exec(files_stmt).all():
            self.session.delete(file)

        folders_stmt = select(Folder).where(Folder.filepath.startswith(prefix))
        for folder in self.session.exec(folders_stmt).all():
            self.session.delete(folder)

        self._commit()

    # ------------------------------------------------------------------
    # Recommendation helpers
    # ------------------------------------------------------------------

    def get_favorite_author_frequencies(self, favorite_dir: str) -> dict[str, int]:
        """作者在 favorite 目录中出现次数。"""
        stmt = (
            select(FileArtist.artist_name, func.count(FileArtist.filepath))
            .join(File, File.filepath == FileArtist.filepath)
            .where(FileArtist.role == "")
            .where(File.filepath.startswith(favorite_dir))
            .group_by(FileArtist.artist_name)
        )
        return {name: int(cnt) for name, cnt in self.session.exec(stmt).all()}

    def get_favorite_tag_frequencies(self, favorite_dir: str) -> dict[str, int]:
        """标签在 favorite 目录中出现次数。"""
        stmt = (
            select(FileTag.tag_name, func.count(FileTag.filepath))
            .join(File, File.filepath == FileTag.filepath)
            .where(File.filepath.startswith(favorite_dir))
            .group_by(FileTag.tag_name)
        )
        return {name: int(cnt) for name, cnt in self.session.exec(stmt).all()}

    def get_tag_total_counts(self) -> dict[str, int]:
        """每个 tag 在整个库中的文件总数。"""
        stmt = select(FileTag.tag_name, func.count(FileTag.filepath)).group_by(FileTag.tag_name)
        return {name: int(cnt) for name, cnt in self.session.exec(stmt).all()}

    def get_artists_by_filepaths(self, filepaths: list[str]) -> dict[str, list[str]]:
        if not filepaths:
            return {}

        stmt = select(FileArtist.filepath, FileArtist.artist_name).where(
            FileArtist.filepath.in_(filepaths),
            FileArtist.role == "",
        )
        out: dict[str, list[str]] = {}
        for filepath, artist_name in self.session.exec(stmt).all():
            out.setdefault(filepath, []).append(artist_name)
        return out

    def get_cosers_by_filepaths(self, filepaths: list[str]) -> dict[str, list[str]]:
        if not filepaths:
            return {}

        stmt = select(FileArtist.filepath, FileArtist.artist_name).where(
            FileArtist.filepath.in_(filepaths),
            FileArtist.role == "coser",
        )
        out: dict[str, list[str]] = {}
        for filepath, artist_name in self.session.exec(stmt).all():
            out.setdefault(filepath, []).append(artist_name)
        return out

    def get_tags_by_filepaths(self, filepaths: list[str]) -> dict[str, list[str]]:
        if not filepaths:
            return {}

        stmt = select(FileTag.filepath, FileTag.tag_name).where(FileTag.filepath.in_(filepaths))
        out: dict[str, list[str]] = {}
        for filepath, tag_name in self.session.exec(stmt).all():
            out.setdefault(filepath, []).append(tag_name)
        return out

    def get_archive_metas_by_filepaths(self, filepaths: list[str]) -> list[ArchiveMeta]:
        """获取多个压缩包的元数据。"""
        if not filepaths:
            return []

        stmt = select(ArchiveMeta).where(ArchiveMeta.filepath.in_(filepaths))
        return list(self.session.exec(stmt).all())

    # ------------------------------------------------------------------
    # Optimized folder-level queries (for /fs/list performance)
    # ------------------------------------------------------------------

    def get_file_data_by_folder(self, folderpath: str) -> dict[str, dict]:
        """一次查出目录下所有文件的 rec_score，返回 {filepath: {rec_score: float}}。"""
        stmt = select(File.filepath, File.rec_score).where(File.folderpath == folderpath)
        return {
            fp: {"rec_score": score}
            for fp, score in self.session.exec(stmt).all()
        }

    def get_archive_metas_by_folder(self, folderpath: str) -> dict[str, ArchiveMeta]:
        """通过子查询获取目录下所有压缩包的元数据。"""
        sub = select(File.filepath).where(
            File.folderpath == folderpath,
            File.file_type == "archive",
        )
        stmt = select(ArchiveMeta).where(ArchiveMeta.filepath.in_(sub))
        return {meta.filepath: meta for meta in self.session.exec(stmt).all()}

    def batch_update_rec_scores(self, scores: dict[str, float]) -> None:
        """批量更新文件的 rec_score。"""
        if not scores:
            return

        filepaths = list(scores.keys())
        # 分批处理，避免 SQLite 参数限制
        batch_size = 500
        for i in range(0, len(filepaths), batch_size):
            batch_fps = filepaths[i : i + batch_size]
            stmt = select(File).where(File.filepath.in_(batch_fps))
            files = self.session.exec(stmt).all()
            for f in files:
                f.rec_score = scores.get(f.filepath, 0.0)

        self._commit()
