from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

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


def test_list_directory_traversal_blocked(client_with_root: TestClient, test_fs_root: Path) -> None:
    """Test that directory traversal is blocked."""
    parent = test_fs_root.parent
    response = client_with_root.get(f"/api/v1/fs/list?path={parent}")
    assert response.status_code == 403


def test_get_thumbnail_not_found(client_with_root: TestClient, test_fs_root: Path) -> None:
    """Test thumbnail for non-existent file."""
    response = client_with_root.get(f"/api/v1/fs/thumb?path={test_fs_root}/nonexistent.jpg")
    assert response.status_code == 404


def test_get_thumbnail_unsupported_type(client_with_root: TestClient, test_fs_root: Path) -> None:
    """Test thumbnail for unsupported file type."""
    response = client_with_root.get(f"/api/v1/fs/thumb?path={test_fs_root}/test.txt")
    assert response.status_code == 400
    assert "not supported" in response.json()["detail"].lower()


def test_get_thumbnail_traversal_blocked(client_with_root: TestClient, test_fs_root: Path) -> None:
    """Test that thumbnail path traversal is blocked."""
    parent = test_fs_root.parent
    response = client_with_root.get(f"/api/v1/fs/thumb?path={parent}/some_image.jpg")
    assert response.status_code == 403


def test_no_roots_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test behavior when no FS_ROOTS configured."""
    monkeypatch.setattr(settings, "FS_ROOTS", "")
    client = TestClient(app)
    
    response = client.get("/api/v1/fs/roots")
    assert response.status_code == 200
    assert response.json() == []
    
    response = client.get("/api/v1/fs/list?path=/some/path")
    assert response.status_code == 500
    assert "No FS_ROOTS configured" in response.json()["detail"]
