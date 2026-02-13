from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.routes import fs as fs_route
from app.core.config import settings
from app.main import app


@pytest.fixture
def test_fs_root(tmp_path: Path) -> Path:
    """Create a test filesystem structure."""
    root = tmp_path / "test_root"
    root.mkdir()
    
    # Create folders
    (root / "folder1").mkdir()
    (root / "folder2").mkdir()
    
    # Create files
    (root / "test.txt").write_text("test content")
    (root / "image.jpg").write_bytes(b"fake jpg")
    (root / "video.mp4").write_bytes(b"fake mp4")
    
    return root


@pytest.fixture
def client_with_root(test_fs_root: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Create test client with mocked FS_ROOTS."""
    monkeypatch.setattr(settings, "FS_ROOTS", str(test_fs_root))
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_scan_state() -> None:
    fs_route._scan_status.clear()
    fs_route._active_watchers.clear()


def test_get_roots(client_with_root: TestClient, test_fs_root: Path) -> None:
    """Test GET /api/v1/fs/roots."""
    response = client_with_root.get("/api/v1/fs/roots")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) == 1
    assert data[0]["path"] == str(test_fs_root)
    assert data[0]["dirname"] == "test_root"


def test_list_directory(client_with_root: TestClient, test_fs_root: Path) -> None:
    """Test GET /api/v1/fs/list."""
    response = client_with_root.get(f"/api/v1/fs/list?path={test_fs_root}")
    assert response.status_code == 200
    
    data = response.json()
    items = data["items"]
    
    # Should have 2 folders + 3 files
    assert len(items) == 5
    
    # Folders should come first
    assert items[0]["item_type"] == "folder"
    assert items[1]["item_type"] == "folder"
    
    # Check file types
    file_items = [item for item in items if item["item_type"] == "file"]
    assert len(file_items) == 3
    
    # Check thumbnail URLs
    jpg_item = next(item for item in items if item["name"] == "image.jpg")
    assert jpg_item["thumbnail_url"] is not None
    assert "/api/v1/fs/thumb?path=" in jpg_item["thumbnail_url"]
    
    mp4_item = next(item for item in items if item["name"] == "video.mp4")
    assert mp4_item["thumbnail_url"] is not None
    
    txt_item = next(item for item in items if item["name"] == "test.txt")
    assert txt_item["thumbnail_url"] is None


def test_list_directory_not_found(client_with_root: TestClient, test_fs_root: Path) -> None:
    """Test listing non-existent directory."""
    response = client_with_root.get(f"/api/v1/fs/list?path={test_fs_root}/nonexistent")
    assert response.status_code == 404


def test_list_directory_outside_root(client_with_root: TestClient, test_fs_root: Path) -> None:
    """Test that directories outside root can be accessed (no restriction)."""
    parent = test_fs_root.parent
    response = client_with_root.get(f"/api/v1/fs/list?path={parent}")
    # Should succeed now that path restrictions are removed
    assert response.status_code == 200


def test_get_thumbnail_not_found(client_with_root: TestClient, test_fs_root: Path) -> None:
    """Test thumbnail for non-existent file."""
    response = client_with_root.get(f"/api/v1/fs/thumb?path={test_fs_root}/nonexistent.jpg")
    assert response.status_code == 404


def test_get_thumbnail_unsupported_type(client_with_root: TestClient, test_fs_root: Path) -> None:
    """Test thumbnail for unsupported file type."""
    response = client_with_root.get(f"/api/v1/fs/thumb?path={test_fs_root}/test.txt")
    assert response.status_code == 400
    assert "not supported" in response.json()["detail"].lower()


def test_get_thumbnail_outside_root(client_with_root: TestClient, test_fs_root: Path) -> None:
    """Test that thumbnails outside root can be accessed (no restriction)."""
    parent = test_fs_root.parent
    # Create a test image outside root
    test_image = parent / "outside_image.jpg"
    test_image.write_bytes(b"fake jpg")
    
    response = client_with_root.get(f"/api/v1/fs/thumb?path={test_image}")
    # Should not be 403 anymore (will be 400 or 500 due to actual thumbnail generation)
    assert response.status_code != 403
    
    # Cleanup
    test_image.unlink()


def test_no_roots_configured(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Test behavior when no FS_ROOTS configured."""
    monkeypatch.setattr(settings, "FS_ROOTS", "")
    client = TestClient(app)
    
    response = client.get("/api/v1/fs/roots")
    assert response.status_code == 200
    assert response.json() == []
    
    # Create a test directory
    test_dir = tmp_path / "test_dir"
    test_dir.mkdir()
    
    # Should still work without FS_ROOTS configured
    response = client.get(f"/api/v1/fs/list?path={test_dir}")
    assert response.status_code == 200


def test_scan_watch_and_scan_status(client_with_root: TestClient, test_fs_root: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """scan-watch should initialize a complete status payload and status endpoint should validate."""

    class DummyWatcher:
        def __init__(self, path: Path):
            self.path = path

        def start(self) -> None:
            return None

    def fake_run_scan(path: Path, recursive: bool) -> None:
        fs_route._update_scan_status(
            str(path),
            path=str(path),
            status="completed",
            message="Scan completed",
            recursive=recursive,
            scanned_folders=1,
            scanned_files=1,
            parsed_files=0,
            watcher_active=True,
        )

    monkeypatch.setattr(fs_route, "FolderWatcher", DummyWatcher)
    monkeypatch.setattr(fs_route, "_run_scan", fake_run_scan)

    response = client_with_root.post(
        "/api/v1/fs/scan-watch",
        json={"path": str(test_fs_root), "recursive": True},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "started"
    assert payload["path"] == str(test_fs_root)

    status_response = client_with_root.get(f"/api/v1/fs/scan-status?path={test_fs_root}")
    assert status_response.status_code == 200
    items = status_response.json()
    assert len(items) == 1
    assert items[0]["path"] == str(test_fs_root)
    assert items[0]["status"] in ("running", "completed")


def test_scan_status_tolerates_partial_record(client_with_root: TestClient, test_fs_root: Path) -> None:
    """status endpoint should not crash when historical records are incomplete."""
    fs_route._scan_status[str(test_fs_root)] = {"watcher_active": True}

    status_response = client_with_root.get(f"/api/v1/fs/scan-status?path={test_fs_root}")
    assert status_response.status_code == 200
    items = status_response.json()
    assert len(items) == 1
    assert items[0]["path"] == str(test_fs_root)
    assert items[0]["status"] == "running"
    assert items[0]["watcher_active"] is True


def test_scan_endpoint_returns_started(client_with_root: TestClient, test_fs_root: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """scan endpoint should return started and schedule scan task."""

    def fake_run_scan(path: Path, recursive: bool) -> None:
        fs_route._update_scan_status(
            str(path),
            path=str(path),
            status="running",
            recursive=recursive,
            watcher_active=False,
        )

    monkeypatch.setattr(fs_route, "_run_scan", fake_run_scan)

    response = client_with_root.post(
        "/api/v1/fs/scan",
        json={"path": str(test_fs_root), "recursive": False},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "started"
    assert payload["path"] == str(test_fs_root)
