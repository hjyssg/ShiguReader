from __future__ import annotations

import shutil
from pathlib import Path
from types import SimpleNamespace
from contextlib import contextmanager
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
    fs_route._scan_live_cache.clear()
    fs_route._scan_snapshot_cache.clear()


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
        json={"path": str(target), "permanently": True},
    )
    assert response.status_code == 200
    assert not target.exists()


def test_delete_folder_success(client_with_root: TestClient, test_fs_root: Path) -> None:
    target = test_fs_root / "folder2"
    response = client_with_root.request(
        "DELETE",
        "/api/v1/fs/delete",
        json={"path": str(target), "permanently": True},
    )
    assert response.status_code == 200
    assert not target.exists()


def test_delete_file_to_recycle_bin(client_with_root: TestClient, test_fs_root: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    target = test_fs_root / "test.txt"
    called: dict[str, str] = {}

    def fake_send2trash(path: str) -> None:
        called["path"] = path

    monkeypatch.setattr(fs_route, "send2trash", fake_send2trash)

    response = client_with_root.request(
        "DELETE",
        "/api/v1/fs/delete",
        json={"path": str(target), "permanently": False},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Moved to recycle bin"
    assert called.get("path") == str(target)


def test_delete_folder_to_recycle_bin(client_with_root: TestClient, test_fs_root: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    target = test_fs_root / "folder2"
    called: dict[str, str] = {}

    def fake_send2trash(path: str) -> None:
        called["path"] = path

    monkeypatch.setattr(fs_route, "send2trash", fake_send2trash)

    response = client_with_root.request(
        "DELETE",
        "/api/v1/fs/delete",
        json={"path": str(target), "permanently": False},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Moved to recycle bin"
    assert called.get("path") == str(target)


def test_delete_to_recycle_bin_error_returns_500(
    client_with_root: TestClient,
    test_fs_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    target = test_fs_root / "test.txt"

    def fake_send2trash(_path: str) -> None:
        raise OSError("recycle failed")

    monkeypatch.setattr(fs_route, "send2trash", fake_send2trash)

    response = client_with_root.request(
        "DELETE",
        "/api/v1/fs/delete",
        json={"path": str(target), "permanently": False},
    )

    assert response.status_code == 500
    assert "Delete failed" in response.json()["detail"]


def test_permission_denied_detail_contains_debug_fields() -> None:
    """权限错误详情应包含 operation/path/winerror 等调试信息。"""
    err = PermissionError(13, "Permission denied", r"D:\\data\\locked.txt")
    # 模拟 Windows 常见占用场景
    setattr(err, "winerror", 32)

    detail = fs_route._build_permission_denied_detail(
        "delete file",
        Path(r"D:\\data\\locked.txt"),
        err,
    )

    assert "delete file failed (permission denied)" in detail
    assert r"path=D:\data\locked.txt" in detail
    assert "errno=13" in detail
    assert "winerror=32" in detail
    assert "hint=file is likely in use by another process" in detail


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


def test_refresh_all_rec_scores_accepts_scalar_filepath_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    """_refresh_all_rec_scores should handle scalar rows from single-column select()."""

    class DummySession:
        def __init__(self) -> None:
            self.calls = 0

        def exec(self, _stmt):
            self.calls += 1
            if self.calls == 1:
                return ["/fav/a.cbz", "/fav/b.cbz"]
            return ["/fav/b.cbz", "/fav/c.cbz"]

    class DummyRepo:
        def __init__(self) -> None:
            self.session = DummySession()
            self.updated_scores_calls = 0

        def get_artists_by_filepaths(self, filepaths: list[str]):
            return {fp: [] for fp in filepaths}

        def get_tags_by_filepaths(self, filepaths: list[str]):
            return {fp: [] for fp in filepaths}

        def batch_update_rec_scores(self, scores: dict[str, float]) -> None:
            assert scores
            self.updated_scores_calls += 1

        def get_favorite_author_frequencies(self, _favorite_dir: str):
            return {"author": 1}

        def get_favorite_tag_frequencies(self, _favorite_dir: str):
            return {"tag": 1}

        def get_tag_total_counts(self):
            return {"tag": 1}

    monkeypatch.setattr(settings, "FAVORITE_DIR", "/fav")
    repo = DummyRepo()

    fs_route._refresh_all_rec_scores(repo)

    assert repo.updated_scores_calls >= 1


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


def test_rename_file_success(client_with_root: TestClient, test_fs_root: Path) -> None:
    """测试文件重命名成功。"""
    src = test_fs_root / "test.txt"
    new_name = "renamed.txt"
    
    response = client_with_root.post(
        "/api/v1/fs/rename",
        json={"path": str(src), "new_name": new_name},
    )
    assert response.status_code == 200
    assert (test_fs_root / new_name).exists()
    assert not src.exists()


def test_rename_folder_success(client_with_root: TestClient, test_fs_root: Path) -> None:
    """测试文件夹重命名成功。"""
    src = test_fs_root / "folder1"
    new_name = "renamed_folder"
    
    response = client_with_root.post(
        "/api/v1/fs/rename",
        json={"path": str(src), "new_name": new_name},
    )
    assert response.status_code == 200
    assert (test_fs_root / new_name).exists()
    assert not src.exists()


def test_rename_conflict(client_with_root: TestClient, test_fs_root: Path) -> None:
    """测试重命名时目标已存在。"""
    src = test_fs_root / "test.txt"
    
    response = client_with_root.post(
        "/api/v1/fs/rename",
        json={"path": str(src), "new_name": "image.jpg"},  # 已存在
    )
    assert response.status_code == 409


def test_download_file(client_with_root: TestClient, test_fs_root: Path) -> None:
    """测试文件下载。"""
    file_path = test_fs_root / "test.txt"
    
    response = client_with_root.get(f"/api/v1/fs/download?path={file_path}")
    assert response.status_code == 200
    assert response.content == b"test content"
    assert "attachment" in response.headers.get("content-disposition", "").lower()


def test_unzip_archive_success(client_with_root: TestClient, test_fs_root: Path) -> None:
    """测试解压压缩包成功。"""
    import zipfile
    
    archive = test_fs_root / "test.zip"
    with zipfile.ZipFile(archive, "w") as zf:
        zf.writestr("file1.txt", b"content1")
        zf.writestr("subdir/file2.txt", b"content2")
    
    response = client_with_root.post(
        "/api/v1/fs/unzip",
        json={"archive_path": str(archive)},
    )
    assert response.status_code == 200
    
    # 默认解压到同名文件夹
    output_dir = test_fs_root / "test"
    assert output_dir.exists()
    assert (output_dir / "file1.txt").exists()
    assert (output_dir / "subdir" / "file2.txt").exists()


def test_unzip_archive_preserve_structure(client_with_root: TestClient, test_fs_root: Path) -> None:
    """测试解压保持原始目录结构。"""
    import zipfile
    
    archive = test_fs_root / "nested.zip"
    with zipfile.ZipFile(archive, "w") as zf:
        zf.writestr("a/b/c/file.txt", b"nested content")
    
    response = client_with_root.post(
        "/api/v1/fs/unzip",
        json={"archive_path": str(archive)},
    )
    assert response.status_code == 200
    
    output_dir = test_fs_root / "nested"
    assert (output_dir / "a" / "b" / "c" / "file.txt").exists()


def test_backfill_directory_success(
    client_with_root: TestClient,
    test_fs_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """应能补全目录及子目录缺失的 thumbnail 与 meta。"""
    import zipfile

    image_file = test_fs_root / "cover.jpg"
    image_file.write_bytes(b"fake-image")

    archive_file = test_fs_root / "[作者] 作品.zip"
    with zipfile.ZipFile(archive_file, "w") as zf:
        zf.writestr("001.jpg", b"fake-jpg")
        zf.writestr("clip.mp4", b"fake-mp4")

    nested = test_fs_root / "nested"
    nested.mkdir(exist_ok=True)
    nested_archive = nested / "[作者2] 子作品.zip"
    with zipfile.ZipFile(nested_archive, "w") as zf:
        zf.writestr("001.jpg", b"fake-jpg")

    class FakeThumbService:
        async def get_or_generate(self, _filepath: Path, *, force: bool = False):
            return test_fs_root / "thumb.webp"

    class FakeRepo:
        def __init__(self, _session):
            self.files: dict[str, object] = {}
            self.folders: set[str] = set()
            self.parsed: set[str] = set()
            self.archive_meta: set[str] = set()

        def upsert_folder(self, data):
            self.folders.add(data.filepath)
            return SimpleNamespace(filepath=data.filepath)

        def get_file(self, filepath: str):
            return self.files.get(filepath)

        def upsert_file(self, data):
            row = SimpleNamespace(filepath=data.filepath, thumbnail_filepath=None)
            self.files[data.filepath] = row
            return row

        def get_parsed_metadata(self, filepath: str):
            return SimpleNamespace(filepath=filepath) if filepath in self.parsed else None

        def save_parse_result(self, filepath: str, **_kwargs):
            self.parsed.add(filepath)

        def get_archive_meta(self, filepath: str):
            return SimpleNamespace(filepath=filepath) if filepath in self.archive_meta else None

        def upsert_archive_meta(self, filepath: str, **_kwargs):
            self.archive_meta.add(filepath)

    @contextmanager
    def fake_get_index_session():
        yield object()

    async def fake_get_thumb_service():
        return FakeThumbService()

    monkeypatch.setattr(fs_route.ThumbService, "get_instance", staticmethod(fake_get_thumb_service))
    monkeypatch.setattr(fs_route, "IndexRepository", FakeRepo)
    monkeypatch.setattr(fs_route, "get_index_session", fake_get_index_session)
    monkeypatch.setattr(
        fs_route,
        "list_archive_entries",
        lambda _p: ["001.jpg", "clip.mp4"],
    )

    def fake_parse(name: str):
        if name.endswith(".zip"):
            return SimpleNamespace(
                title="作品",
                authors=["作者"],
                cosers=[],
                group=None,
                raw_tags=["标签"],
                event=None,
                date_tag=None,
                type="doujinshi",
            )
        return None

    monkeypatch.setattr(fs_route, "parse", fake_parse)

    response = client_with_root.post(
        "/api/v1/fs/backfill",
        json={
            "path": str(test_fs_root),
            "recursive": True,
            "fill_thumbnail": True,
            "fill_meta": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["scanned_files"] >= 3
    assert payload["backfilled_thumbnails"] >= 3  # cover.jpg + 两个 zip
    assert payload["backfilled_meta"] >= 4  # 两个 zip 的 parse + 两个 zip 的 archive_meta


def test_backfill_directory_non_recursive(
    client_with_root: TestClient,
    test_fs_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """recursive=false 时只处理当前目录文件。"""
    import zipfile

    root_archive = test_fs_root / "[A] root.zip"
    with zipfile.ZipFile(root_archive, "w") as zf:
        zf.writestr("001.jpg", b"fake-jpg")

    nested_dir = test_fs_root / "sub"
    nested_dir.mkdir(exist_ok=True)
    nested_archive = nested_dir / "[B] nested.zip"
    with zipfile.ZipFile(nested_archive, "w") as zf:
        zf.writestr("001.jpg", b"fake-jpg")

    class FakeThumbService:
        async def get_or_generate(self, _filepath: Path, *, force: bool = False):
            return test_fs_root / "thumb.webp"

    class FakeRepo:
        def __init__(self, _session):
            self.files: dict[str, object] = {}
            self.folders: set[str] = set()
            self.parsed: set[str] = set()
            self.archive_meta: set[str] = set()

        def upsert_folder(self, data):
            self.folders.add(data.filepath)
            return SimpleNamespace(filepath=data.filepath)

        def get_file(self, filepath: str):
            return self.files.get(filepath)

        def upsert_file(self, data):
            row = SimpleNamespace(filepath=data.filepath, thumbnail_filepath=None)
            self.files[data.filepath] = row
            return row

        def get_parsed_metadata(self, filepath: str):
            return SimpleNamespace(filepath=filepath) if filepath in self.parsed else None

        def save_parse_result(self, filepath: str, **_kwargs):
            self.parsed.add(filepath)

        def get_archive_meta(self, filepath: str):
            return SimpleNamespace(filepath=filepath) if filepath in self.archive_meta else None

        def upsert_archive_meta(self, filepath: str, **_kwargs):
            self.archive_meta.add(filepath)

    @contextmanager
    def fake_get_index_session():
        yield object()

    async def fake_get_thumb_service():
        return FakeThumbService()

    monkeypatch.setattr(fs_route.ThumbService, "get_instance", staticmethod(fake_get_thumb_service))
    monkeypatch.setattr(fs_route, "IndexRepository", FakeRepo)
    monkeypatch.setattr(fs_route, "get_index_session", fake_get_index_session)
    monkeypatch.setattr(fs_route, "list_archive_entries", lambda _p: ["001.jpg"])
    monkeypatch.setattr(
        fs_route,
        "parse",
        lambda _name: SimpleNamespace(
            title="作品",
            authors=["作者"],
            cosers=[],
            group=None,
            raw_tags=[],
            event=None,
            date_tag=None,
            type="doujinshi",
        ),
    )

    response = client_with_root.post(
        "/api/v1/fs/backfill",
        json={
            "path": str(test_fs_root),
            "recursive": False,
            "fill_thumbnail": True,
            "fill_meta": True,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    # 不应扫描到 sub/nested.zip
    assert payload["scanned_files"] < 10
    assert payload["backfilled_meta"] >= 2


def test_derive_minimal_root_dirs_removes_nested_dirs() -> None:
    roots = fs_route._derive_minimal_root_dirs([
        "/data/library/a/1.jpg",
        "/data/library/a/sub/2.jpg",
        "/data/library/b/3.jpg",
    ])

    assert roots == [Path('/data/library/a'), Path('/data/library/b')]


def test_scan_root_with_scandir_skips_hidden_and_ignored(tmp_path: Path) -> None:
    root = tmp_path / "root"
    root.mkdir()
    (root / "node_modules").mkdir()
    (root / "node_modules" / "a.jpg").write_bytes(b"x")
    (root / ".hidden").mkdir()
    (root / ".hidden" / "b.jpg").write_bytes(b"x")
    (root / "ok").mkdir()
    (root / "ok" / "keep.jpg").write_bytes(b"x")
    (root / "ok" / "skip.txt").write_text("x")

    result = fs_route._scan_root_with_scandir(root)

    assert str(root / "ok" / "keep.jpg") in result
    assert str(root / "node_modules" / "a.jpg") not in result
    assert str(root / ".hidden" / "b.jpg") not in result
    assert str(root / "ok" / "skip.txt") not in result


def test_collect_cached_scan_for_root_prefers_live_cache(tmp_path: Path) -> None:
    root = tmp_path / "live"
    root.mkdir()
    file_a = root / "a.jpg"
    file_a.write_bytes(b"x")

    fs_route._scan_live_cache[str(root)] = {str(file_a): (1, 2)}
    try:
        result = fs_route._collect_cached_scan_for_root(root)
        assert result == {str(file_a): (1, 2)}
    finally:
        fs_route._scan_live_cache.clear()
        fs_route._scan_snapshot_cache.clear()


def test_should_update_existing_file_restores_deleted_state() -> None:
    assert fs_route._should_update_existing_file(
        db_size=100,
        db_mtime=200,
        db_scan_state=0,
        real_size=100,
        real_mtime=200,
    ) is True


def test_build_folder_sync_mappings_creates_missing_parent_rows() -> None:
    now_ts = 123
    to_insert, to_update = fs_route._build_folder_sync_mappings(
        real_filepaths={"/data/new_dir/a.jpg", "/data/existing_dir/b.jpg"},
        db_folder_paths={"/data/existing_dir"},
        now_ts=now_ts,
    )

    inserted_paths = {item["filepath"] for item in to_insert}
    assert "/data/new_dir" in inserted_paths
    assert "/data/existing_dir" not in inserted_paths

    updated_paths = {item["filepath"] for item in to_update}
    assert "/data/existing_dir" in updated_paths
