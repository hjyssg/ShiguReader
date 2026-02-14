from __future__ import annotations

import shutil
from pathlib import Path
from urllib.parse import quote

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


def test_list_directory_thumbnail_url_is_encoded(client_with_root: TestClient, test_fs_root: Path) -> None:
    """Thumbnail URL should percent-encode special chars to avoid broken query parsing."""
    special_name = "[あんてきぬすっ]OVA夏妻 .jpg"
    special_path = test_fs_root / special_name
    special_path.write_bytes(b"fake jpg")

    response = client_with_root.get(f"/api/v1/fs/list?path={test_fs_root}")
    assert response.status_code == 200

    item = next(x for x in response.json()["items"] if x["name"] == special_name)
    assert item["thumbnail_url"] is not None
    expected = f"/api/v1/fs/thumb?path={quote(str(special_path), safe='')}"
    assert item["thumbnail_url"] == expected


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


def test_move_file_success(client_with_root: TestClient, test_fs_root: Path) -> None:
    src = test_fs_root / "test.txt"
    dst = test_fs_root / "folder1" / "moved.txt"

    response = client_with_root.post(
        "/api/v1/fs/move-file",
        json={"source_path": str(src), "dest_path": str(dst)},
    )
    assert response.status_code == 200
    assert dst.exists()
    assert not src.exists()


def test_move_folder_success(client_with_root: TestClient, test_fs_root: Path) -> None:
    src = test_fs_root / "folder2"
    dst = test_fs_root / "folder1" / "moved-folder2"

    response = client_with_root.post(
        "/api/v1/fs/move-folder",
        json={"source_path": str(src), "dest_path": str(dst)},
    )
    assert response.status_code == 200
    assert dst.exists()
    assert not src.exists()


def test_move_folder_into_subfolder_rejected(client_with_root: TestClient, test_fs_root: Path) -> None:
    src = test_fs_root / "folder1"
    dst = src / "nested"

    response = client_with_root.post(
        "/api/v1/fs/move-folder",
        json={"source_path": str(src), "dest_path": str(dst)},
    )
    assert response.status_code == 400


def test_delete_file_success(client_with_root: TestClient, test_fs_root: Path) -> None:
    target = test_fs_root / "test.txt"
    response = client_with_root.request(
        "DELETE",
        "/api/v1/fs/delete",
        json={"path": str(target)},
    )
    assert response.status_code == 200
    assert not target.exists()


def test_delete_folder_success(client_with_root: TestClient, test_fs_root: Path) -> None:
    target = test_fs_root / "folder2"
    response = client_with_root.request(
        "DELETE",
        "/api/v1/fs/delete",
        json={"path": str(target)},
    )
    assert response.status_code == 200
    assert not target.exists()


def test_zip_folder_success(client_with_root: TestClient, test_fs_root: Path) -> None:
    output = test_fs_root / "archive.zip"
    response = client_with_root.post(
        "/api/v1/fs/zip-folder",
        json={"folder_path": str(test_fs_root / "folder1"), "output_path": str(output)},
    )
    assert response.status_code == 200
    assert output.exists()


def test_list_directory_supports_recommendation_sort(client_with_root: TestClient, test_fs_root: Path) -> None:
    response = client_with_root.get(
        f"/api/v1/fs/list?path={test_fs_root}&sort_by=recommendation&sort_order=desc"
    )
    assert response.status_code == 200
    items = response.json()["items"]
    file_items = [x for x in items if x["item_type"] == "file"]
    assert all("recommendation_score" in x for x in file_items)


def test_scan_favorite_not_configured(client_with_root: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "FAVORITE_DIR", "")
    response = client_with_root.post("/api/v1/fs/scan-favorite")
    assert response.status_code == 400


def test_list_directory_filter_by_video(client_with_root: TestClient, test_fs_root: Path) -> None:
    """测试按是否包含视频筛选压缩包。"""
    # 创建测试压缩包
    import zipfile
    
    # 包含视频的压缩包
    archive_with_video = test_fs_root / "with_video.zip"
    with zipfile.ZipFile(archive_with_video, "w") as zf:
        zf.writestr("image1.jpg", b"fake jpg")
        zf.writestr("video1.mp4", b"fake mp4")
    
    # 不包含视频的压缩包
    archive_without_video = test_fs_root / "without_video.zip"
    with zipfile.ZipFile(archive_without_video, "w") as zf:
        zf.writestr("image1.jpg", b"fake jpg")
        zf.writestr("image2.png", b"fake png")
    
    # 筛选包含视频的压缩包
    response = client_with_root.get(
        f"/api/v1/fs/list?path={test_fs_root}&has_video=true"
    )
    assert response.status_code == 200
    items = response.json()["items"]
    archive_items = [x for x in items if x["file_type"] == "archive"]
    
    # 应该只返回包含视频的压缩包
    assert len(archive_items) == 1
    assert archive_items[0]["name"] == "with_video.zip"
    
    # 筛选不包含视频的压缩包
    response = client_with_root.get(
        f"/api/v1/fs/list?path={test_fs_root}&has_video=false"
    )
    assert response.status_code == 200
    items = response.json()["items"]
    archive_items = [x for x in items if x["file_type"] == "archive"]
    
    # 应该返回不包含视频的压缩包和其他文件
    archive_names = [x["name"] for x in archive_items]
    assert "without_video.zip" in archive_names
    assert "with_video.zip" not in archive_names


def test_list_directory_filter_by_audio(client_with_root: TestClient, test_fs_root: Path) -> None:
    """测试按是否包含音频筛选压缩包。"""
    import zipfile
    
    # 包含音频的压缩包
    archive_with_audio = test_fs_root / "with_audio.zip"
    with zipfile.ZipFile(archive_with_audio, "w") as zf:
        zf.writestr("image1.jpg", b"fake jpg")
        zf.writestr("music.mp3", b"fake mp3")
    
    # 不包含音频的压缩包
    archive_without_audio = test_fs_root / "without_audio.zip"
    with zipfile.ZipFile(archive_without_audio, "w") as zf:
        zf.writestr("image1.jpg", b"fake jpg")
    
    # 筛选包含音频的压缩包
    response = client_with_root.get(
        f"/api/v1/fs/list?path={test_fs_root}&has_audio=true"
    )
    assert response.status_code == 200
    items = response.json()["items"]
    archive_items = [x for x in items if x["file_type"] == "archive"]
    
    assert len(archive_items) == 1
    assert archive_items[0]["name"] == "with_audio.zip"


def test_list_directory_sort_by_image_count(client_with_root: TestClient, test_fs_root: Path) -> None:
    """测试按图片数量排序压缩包。"""
    import zipfile
    
    # 创建包含不同数量图片的压缩包
    archive_5_images = test_fs_root / "archive_5.zip"
    with zipfile.ZipFile(archive_5_images, "w") as zf:
        for i in range(5):
            zf.writestr(f"image{i}.jpg", b"fake jpg")
    
    archive_10_images = test_fs_root / "archive_10.zip"
    with zipfile.ZipFile(archive_10_images, "w") as zf:
        for i in range(10):
            zf.writestr(f"image{i}.jpg", b"fake jpg")
    
    archive_2_images = test_fs_root / "archive_2.zip"
    with zipfile.ZipFile(archive_2_images, "w") as zf:
        for i in range(2):
            zf.writestr(f"image{i}.jpg", b"fake jpg")
    
    # 按图片数量升序排序
    response = client_with_root.get(
        f"/api/v1/fs/list?path={test_fs_root}&sort_by=image_count&sort_order=asc"
    )
    assert response.status_code == 200
    items = response.json()["items"]
    archive_items = [x for x in items if x["file_type"] == "archive"]
    
    # 验证排序顺序
    assert len(archive_items) >= 3
    image_counts = [x.get("image_count", 0) for x in archive_items]
    assert image_counts == sorted(image_counts)
    
    # 按图片数量降序排序
    response = client_with_root.get(
        f"/api/v1/fs/list?path={test_fs_root}&sort_by=image_count&sort_order=desc"
    )
    assert response.status_code == 200
    items = response.json()["items"]
    archive_items = [x for x in items if x["file_type"] == "archive"]
    
    image_counts = [x.get("image_count", 0) for x in archive_items]
    assert image_counts == sorted(image_counts, reverse=True)


def test_list_directory_includes_archive_metadata(client_with_root: TestClient, test_fs_root: Path) -> None:
    """测试返回的文件列表包含压缩包元数据。"""
    import zipfile
    
    archive = test_fs_root / "test_archive.zip"
    with zipfile.ZipFile(archive, "w") as zf:
        zf.writestr("image1.jpg", b"fake jpg")
        zf.writestr("image2.jpg", b"fake jpg")
        zf.writestr("video.mp4", b"fake mp4")
        zf.writestr("music.mp3", b"fake mp3")
    
    response = client_with_root.get(f"/api/v1/fs/list?path={test_fs_root}")
    assert response.status_code == 200
    items = response.json()["items"]
    
    archive_item = next((x for x in items if x["name"] == "test_archive.zip"), None)
    assert archive_item is not None
    
    # 验证包含元数据字段
    assert "image_count" in archive_item
    assert "video_count" in archive_item
    assert "audio_count" in archive_item
