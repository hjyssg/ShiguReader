from __future__ import annotations

from dataclasses import dataclass
from time import time

from sqlmodel import Session

from app.index_db.models import File, Folder


def _now_ts() -> int:
    return int(time())


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
    def __init__(self, session: Session) -> None:
        self.session = session

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
            self.session.commit()
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
        self.session.commit()
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
            self.session.commit()
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
        self.session.commit()
        self.session.refresh(file)
        return file
