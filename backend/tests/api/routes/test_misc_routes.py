"""Smoke tests for API routes that previously lacked UT coverage."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.index_db.bootstrap import ensure_index_db_initialized
from app.index_db.db import clear_index_engine_cache


@pytest.fixture
def misc_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Bind index DB to a temporary sqlite file and return API client."""
    db_file = tmp_path / "misc_test_index.db"
    db_url = f"sqlite:///{db_file.as_posix()}"
    ensure_index_db_initialized(db_url)

    clear_index_engine_cache()
    monkeypatch.setattr(settings, "INDEX_SQLITE_URL", db_url)
    clear_index_engine_cache()

    from app.main import app

    with TestClient(app) as client:
        yield client

    clear_index_engine_cache()


def test_history_list_empty(misc_client: TestClient) -> None:
    response = misc_client.get("/api/v1/history/list")

    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0


def test_authors_and_cosers_empty(misc_client: TestClient) -> None:
    authors_resp = misc_client.get("/api/v1/authors")
    cosers_resp = misc_client.get("/api/v1/cosers")

    assert authors_resp.status_code == 200
    assert authors_resp.json()["items"] == []

    assert cosers_resp.status_code == 200
    assert cosers_resp.json()["items"] == []


def test_parse_batch_with_unknown_filename(misc_client: TestClient) -> None:
    response = misc_client.post(
        "/api/v1/parse/batch",
        json={"filepaths": ["/tmp/just_a_normal_name.txt"]},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 1
    assert len(data["items"]) == 1


def test_settings_read(misc_client: TestClient) -> None:
    response = misc_client.get("/api/v1/settings")

    assert response.status_code == 200
    data = response.json()
    assert "favorite_dir" in data
    assert "fs_roots" in data
    assert "already_read_dir" in data
    assert "move_place_dir" in data
    assert "env_file_path" in data


def test_private_create_user(client: TestClient) -> None:
    response = client.post(
        "/api/v1/private/users/",
        json={
            "email": "private-user@example.com",
            "password": "pass123456",
            "full_name": "private user",
            "is_verified": False,
        },
    )

    assert response.status_code == 200
    assert response.json()["email"] == "private-user@example.com"
