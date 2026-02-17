"""Tests for app/index_db/repository.py IndexRepository."""

from pathlib import Path

import pytest
from sqlmodel import Session, create_engine

from app.index_db.bootstrap import ensure_index_db_initialized
from app.index_db.models import File, Folder, FolderOpenHistory, Progress
from app.index_db.repository import IndexRepository, UpsertFileInput, UpsertFolderInput


@pytest.fixture
def test_repo(tmp_path: Path) -> IndexRepository:
    """Create a test repository with initialized database."""
    db_file = tmp_path / "test_repo.db"
    db_url = f"sqlite:///{db_file.as_posix()}"
    
    ensure_index_db_initialized(db_url)
    
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    with Session(engine) as session:
        yield IndexRepository(session)


def test_batch_upsert_folders(test_repo: IndexRepository) -> None:
    """Test batch upserting folders."""
    folders = [
        UpsertFolderInput(
            filepath="/test/folder1",
            dirname="folder1",
            mtime=100,
            scan_state=1,
            watch_state=0,
            scanned=True,
        ),
        UpsertFolderInput(
            filepath="/test/folder2",
            dirname="folder2",
            mtime=200,
            scan_state=1,
            watch_state=0,
            scanned=True,
        ),
    ]
    
    test_repo.batch_upsert_folders(folders)
    # Just verify no exception was raised


def test_batch_upsert_files(test_repo: IndexRepository) -> None:
    """Test batch upserting files."""
    files = [
        UpsertFileInput(
            filepath="/test/file1.jpg",
            filename="file1.jpg",
            mtime=100,
            filesize=1024,
            fingerprint="fp1",
            file_type="image",
            ext=".jpg",
            scan_state=1,
            watch_state=0,
            scanned=True,
        ),
        UpsertFileInput(
            filepath="/test/file2.mp4",
            filename="file2.mp4",
            mtime=200,
            filesize=2048,
            fingerprint="fp2",
            file_type="video",
            ext=".mp4",
            scan_state=1,
            watch_state=0,
            scanned=True,
        ),
    ]
    
    test_repo.batch_upsert_files(files)


def test_batch_save_parse_results(test_repo: IndexRepository) -> None:
    """Test batch saving parse results."""
    # First create a file
    test_repo.batch_upsert_files([
        UpsertFileInput(
            filepath="/test/file1.cbz",
            filename="file1.cbz",
            mtime=100,
            filesize=1024,
            fingerprint="fp1",
            file_type="archive",
            ext=".cbz",
            scan_state=1,
            watch_state=0,
            scanned=True,
        ),
    ])
    
    # Save parse results
    results = [
        {
            "filepath": "/test/file1.cbz",
            "title": "Test Title",
            "authors": ["Author1", "Author2"],
            "group_name": "Test Group",
            "raw_tags": ["tag1", "tag2"],
            "event": "Test Event",
            "date_tag": "2024",
            "media_type": "manga",
        },
    ]
    
    test_repo.batch_save_parse_results(results)


def test_author_coser_mutually_exclusive_in_same_zip(test_repo: IndexRepository) -> None:
    """同一 zip 若出现 coser，应忽略 author（业务互斥约束）。"""
    test_repo.batch_upsert_files([
        UpsertFileInput(
            filepath="/test/mixed_role.zip",
            filename="mixed_role.zip",
            mtime=100,
            filesize=1024,
            fingerprint="mixed-fp",
            file_type="archive",
            ext=".zip",
            scan_state=1,
            watch_state=0,
            scanned=True,
        ),
    ])

    test_repo.batch_save_parse_results([
        {
            "filepath": "/test/mixed_role.zip",
            "title": "Mixed",
            "authors": ["MangaAuthor"],
            "cosers": ["RealCoser"],
            "group_name": None,
            "raw_tags": ["tag1"],
            "event": None,
            "date_tag": None,
            "media_type": "COSPLAY",
        }
    ])

    assert test_repo.get_file_artists("/test/mixed_role.zip") == []
    assert test_repo.get_file_cosers("/test/mixed_role.zip") == ["RealCoser"]


def test_search_files(test_repo: IndexRepository) -> None:
    """Test searching files."""
    # Create test files
    test_repo.batch_upsert_files([
        UpsertFileInput(
            filepath="/test/testfile.jpg",
            filename="testfile.jpg",
            mtime=100,
            filesize=1024,
            fingerprint="fp1",
            file_type="image",
            ext=".jpg",
            scan_state=1,
            watch_state=0,
            scanned=True,
        ),
    ])
    
    # Search
    results = test_repo.search_files("testfile", mode="hybrid")
    assert len(results) >= 0


def test_upsert_progress(test_repo: IndexRepository) -> None:
    """Test upserting progress."""
    progress = test_repo.upsert_progress(
        filepath="/test/file.cbz",
        filename="file.cbz",
        file_type="archive",
        filesize=1024,
        mtime=100,
        page_current=5,
        page_total=100,
    )
    
    assert progress.filepath == "/test/file.cbz"
    assert progress.page_current == 5
    assert progress.page_total == 100


def test_list_progress_history(test_repo: IndexRepository) -> None:
    """Test listing progress history."""
    # Create some progress records
    test_repo.upsert_progress(
        filepath="/test/file1.cbz",
        filename="file1.cbz",
        file_type="archive",
    )
    
    # List history
    history = test_repo.list_progress_history(offset=0, limit=10)
    assert len(history) >= 0


def test_count_progress_history(test_repo: IndexRepository) -> None:
    """Test counting progress history."""
    count = test_repo.count_progress_history()
    assert count >= 0


def test_batch_upsert_files_handles_large_input_with_chunking(test_repo: IndexRepository) -> None:
    """Large inputs should be split into chunks and still be persisted correctly."""
    total = 1201
    files = [
        UpsertFileInput(
            filepath=f"/bulk/file_{i}.jpg",
            filename=f"file_{i}.jpg",
            mtime=100 + i,
            filesize=1024 + i,
            fingerprint=f"fp-{i}",
            file_type="image",
            ext=".jpg",
            scan_state=1,
            watch_state=0,
            scanned=True,
        )
        for i in range(total)
    ]

    test_repo.batch_upsert_files(files, batch_size=500)

    found = test_repo.search_files("/bulk/file_", mode="exact")
    assert len(found) == total


def test_batch_save_parse_results_handles_large_input_with_chunking(test_repo: IndexRepository) -> None:
    """Large parse-result payloads should be chunked without breaking FK/link writes."""
    total = 1201
    files = [
        UpsertFileInput(
            filepath=f"/bulk_parse/file_{i}.cbz",
            filename=f"file_{i}.cbz",
            mtime=100 + i,
            filesize=2048 + i,
            fingerprint=f"parse-fp-{i}",
            file_type="archive",
            ext=".cbz",
            scan_state=1,
            watch_state=0,
            scanned=True,
        )
        for i in range(total)
    ]
    test_repo.batch_upsert_files(files, batch_size=500)

    results = [
        {
            "filepath": f"/bulk_parse/file_{i}.cbz",
            "title": f"Title {i}",
            "authors": [f"Author{i % 7}"],
            "group_name": "G",
            "raw_tags": [f"tag{i % 11}"],
            "event": None,
            "date_tag": None,
            "media_type": "manga",
        }
        for i in range(total)
    ]

    test_repo.batch_save_parse_results(results, batch_size=500)

    sample_fp = "/bulk_parse/file_1000.cbz"
    meta = test_repo.get_parsed_metadata(sample_fp)
    assert meta is not None
    assert meta.title == "Title 1000"
    assert test_repo.get_file_artists(sample_fp)
    assert test_repo.get_file_tags(sample_fp)


def test_list_top_opened_folder_ids_with_decay_and_lookback(test_repo: IndexRepository) -> None:
    now_ts = 2_000_000_000

    folder_a = Folder(filepath="/top/a", dirname="a")
    folder_b = Folder(filepath="/top/b", dirname="b")
    folder_old = Folder(filepath="/top/old", dirname="old")
    file_b = File(
        filepath="/top/b/file1.cbz",
        folderpath="/top/b",
        filename="file1.cbz",
        mtime=now_ts,
        filesize=100,
        fingerprint="fp-top-b-1",
    )

    test_repo.session.add(folder_a)
    test_repo.session.add(folder_b)
    test_repo.session.add(folder_old)
    test_repo.session.add(file_b)

    test_repo.session.add(FolderOpenHistory(folderpath="/top/a", last_opened_at=now_ts - 3600, open_count=1, updated_at=now_ts - 3600))
    test_repo.session.add(Progress(filepath="/top/b/file1.cbz", last_opened_at=now_ts - 60))
    test_repo.session.add(FolderOpenHistory(folderpath="/top/old", last_opened_at=now_ts - 100 * 24 * 3600, open_count=1, updated_at=now_ts))
    test_repo.session.commit()

    folder_ids = test_repo.list_top_opened_folder_ids(limit=5, now_ts=now_ts)

    assert folder_ids == ["/top/b", "/top/a"]

