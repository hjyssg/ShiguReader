from __future__ import annotations

import sqlite3
import time
from pathlib import Path

import pytest
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, create_engine

from app.index_db.bootstrap import ensure_index_db_initialized
from app.index_db.repository import IndexRepository, UpsertFileInput, UpsertFolderInput


def _sqlite_url(db_file: Path) -> str:
    return f"sqlite:///{db_file.as_posix()}"


def test_ensure_initialized_creates_schema(tmp_path: Path) -> None:
    db_file = tmp_path / "index.db"
    db_url = _sqlite_url(db_file)

    ensure_index_db_initialized(db_url)
    ensure_index_db_initialized(db_url)

    assert db_file.exists()

    with sqlite3.connect(db_file) as conn:
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        assert "folders" in tables
        assert "files" in tables
        assert "archive_meta" in tables
        assert "video_meta" in tables
        assert "progress" in tables
        assert "alembic_version" in tables


def test_constraints_and_trigger_work(tmp_path: Path) -> None:
    db_file = tmp_path / "index.db"
    db_url = _sqlite_url(db_file)
    ensure_index_db_initialized(db_url)

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    with Session(engine) as session:
        session.exec(
            sa.text(
                "INSERT INTO folders (filepath, dirname, scan_state, watch_state) VALUES (:fp, :dn, 1, 0)"
            ),
            params={"fp": "/a", "dn": "a"},
        )
        session.commit()

        row = session.exec(
            sa.text("SELECT updated_at FROM folders WHERE filepath=:fp"),
            params={"fp": "/a"},
        ).one()
        before_updated_at = int(row[0])

        time.sleep(1)
        session.exec(
            sa.text("UPDATE folders SET dirname=:dn WHERE filepath=:fp"),
            params={"dn": "a2", "fp": "/a"},
        )
        session.commit()

        row2 = session.exec(
            sa.text("SELECT updated_at FROM folders WHERE filepath=:fp"),
            params={"fp": "/a"},
        ).one()
        after_updated_at = int(row2[0])
        assert after_updated_at >= before_updated_at

        with pytest.raises(IntegrityError):
            session.exec(
                sa.text(
                    "INSERT INTO folders (filepath, dirname, scan_state, watch_state) VALUES (:fp, :dn, 99, 0)"
                ),
                params={"fp": "/bad", "dn": "bad"},
            )
            session.commit()
        session.rollback()


def test_repository_upsert_flow(tmp_path: Path) -> None:
    db_file = tmp_path / "index.db"
    db_url = _sqlite_url(db_file)
    ensure_index_db_initialized(db_url)

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    with Session(engine) as session:
        repo = IndexRepository(session)

        folder = repo.upsert_folder(
            UpsertFolderInput(
                filepath="/library/comics",
                dirname="comics",
                mtime=100,
                scan_state=1,
                watch_state=1,
                scanned=True,
            )
        )
        assert folder.first_seen_at is not None
        assert folder.last_seen_at is not None
        assert folder.last_scanned_at is not None

        file = repo.upsert_file(
            UpsertFileInput(
                filepath="/library/comics/a.cbz",
                folderpath="/library/comics",
                filename="a.cbz",
                mtime=101,
                filesize=2048,
                fingerprint="fp-1",
                file_type="archive",
                ext=".cbz",
                scan_state=1,
                watch_state=1,
                scanned=True,
            )
        )
        assert file.file_type == "archive"
        assert file.first_seen_at is not None

        first_seen = file.first_seen_at
        updated = repo.upsert_file(
            UpsertFileInput(
                filepath="/library/comics/a.cbz",
                folderpath="/library/comics",
                filename="a.cbz",
                mtime=202,
                filesize=4096,
                fingerprint="fp-2",
                file_type="archive",
                ext=".cbz",
                scan_state=1,
                watch_state=1,
                scanned=True,
            )
        )
        assert updated.filesize == 4096
        assert updated.fingerprint == "fp-2"
        assert updated.first_seen_at == first_seen
