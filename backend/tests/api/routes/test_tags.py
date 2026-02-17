from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine

from app.core.config import settings
from app.index_db.bootstrap import ensure_index_db_initialized
from app.index_db.db import clear_index_engine_cache
from app.index_db.models import File, FileTag, Tag
from app.main import app


@pytest.fixture
def tag_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    db_file = tmp_path / "tags_test_index.db"
    db_url = f"sqlite:///{db_file.as_posix()}"
    ensure_index_db_initialized(db_url)

    clear_index_engine_cache()
    monkeypatch.setattr(settings, "INDEX_SQLITE_URL", db_url)
    clear_index_engine_cache()

    with TestClient(app) as client:
        yield client

    clear_index_engine_cache()


def _insert_tag_file_links(db_url: str, files: list[File], links: list[FileTag], tags: list[Tag]) -> None:
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    with Session(engine) as session:
        for tag in tags:
            session.add(tag)
        for file in files:
            session.add(file)
        for link in links:
            session.add(link)
        session.commit()


def test_tags_thumbnail_fallback_to_next_existing_candidate(
    tag_client: TestClient,
    tmp_path: Path,
) -> None:
    existing = tmp_path / "ok.jpg"
    existing.write_bytes(b"ok")
    missing = tmp_path / "missing.jpg"

    db_url = settings.INDEX_SQLITE_URL
    _insert_tag_file_links(
        db_url,
        files=[
            File(filepath=str(missing), filename=missing.name, mtime=300, filesize=1, fingerprint="f-missing", scan_state=1),
            File(filepath=str(existing), filename=existing.name, mtime=200, filesize=1, fingerprint="f-existing", scan_state=1),
        ],
        tags=[Tag(tag_name="tag-a")],
        links=[
            FileTag(filepath=str(missing), tag_name="tag-a"),
            FileTag(filepath=str(existing), tag_name="tag-a"),
        ],
    )

    resp = tag_client.get("/api/v1/tags?page=1&page_size=24")
    assert resp.status_code == 200
    items = resp.json()["items"]
    row = next(x for x in items if x["name"] == "tag-a")
    assert row["thumbnail"] == f"/api/v1/fs/thumb?path={quote(str(existing), safe='')}"


def test_tags_thumbnail_ignores_scan_state_inactive_latest(tag_client: TestClient, tmp_path: Path) -> None:
    active = tmp_path / "active.jpg"
    active.write_bytes(b"active")
    inactive_newer = tmp_path / "inactive_newer.jpg"
    inactive_newer.write_bytes(b"inactive")

    db_url = settings.INDEX_SQLITE_URL
    _insert_tag_file_links(
        db_url,
        files=[
            File(filepath=str(inactive_newer), filename=inactive_newer.name, mtime=999, filesize=1, fingerprint="f-inactive", scan_state=0),
            File(filepath=str(active), filename=active.name, mtime=100, filesize=1, fingerprint="f-active", scan_state=1),
        ],
        tags=[Tag(tag_name="tag-b")],
        links=[
            FileTag(filepath=str(inactive_newer), tag_name="tag-b"),
            FileTag(filepath=str(active), tag_name="tag-b"),
        ],
    )

    resp = tag_client.get("/api/v1/tags?page=1&page_size=24")
    assert resp.status_code == 200
    items = resp.json()["items"]
    row = next(x for x in items if x["name"] == "tag-b")
    assert row["thumbnail"] == f"/api/v1/fs/thumb?path={quote(str(active), safe='')}"
