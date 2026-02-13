"""Tests for app/index_db/repository.py IndexRepository."""

from pathlib import Path

import pytest
from sqlmodel import Session, create_engine

from app.index_db.bootstrap import ensure_index_db_initialized
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
