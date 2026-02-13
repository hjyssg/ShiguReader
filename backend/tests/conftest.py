"""Project-level test configuration with shared fixtures."""

from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from app.api.deps import get_db
from app.core.db import engine as user_engine
from app.index_db.bootstrap import ensure_index_db_initialized
from app.main import app


@pytest.fixture(name="user_session")
def user_session_fixture() -> Generator[Session, None, None]:
    """Create a temporary in-memory SQLite database for user data."""
    # Use in-memory SQLite for user database
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    
    # Create all tables
    SQLModel.metadata.create_all(test_engine)
    
    with Session(test_engine) as session:
        yield session


@pytest.fixture(name="index_db_url")
def index_db_url_fixture(tmp_path: Path) -> str:
    """Create a temporary SQLite database URL for index data."""
    db_file = tmp_path / "test_index.db"
    db_url = f"sqlite:///{db_file.as_posix()}"
    
    # Initialize the database schema
    ensure_index_db_initialized(db_url)
    
    return db_url


@pytest.fixture(name="client")
def client_fixture(user_session: Session) -> Generator[TestClient, None, None]:
    """Create a test client with overridden database dependency."""
    def get_test_db() -> Generator[Session, None, None]:
        yield user_session
    
    app.dependency_overrides[get_db] = get_test_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()
