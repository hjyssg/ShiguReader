"""Tests for app/core/db.py database initialization."""

from sqlmodel import Session

from app import crud
from app.core.db import init_db
from app.models import UserCreate


def test_init_db_creates_superuser(user_session: Session) -> None:
    """Test that init_db creates the first superuser."""
    # Run init_db
    init_db(user_session)
    
    # Verify superuser was created
    from app.core.config import settings
    user = crud.get_user_by_email(
        session=user_session,
        email=settings.FIRST_SUPERUSER,
    )
    
    assert user is not None
    assert user.is_superuser is True


def test_init_db_idempotent(user_session: Session) -> None:
    """Test that init_db can be called multiple times safely."""
    # Run init_db twice
    init_db(user_session)
    init_db(user_session)
    
    # Should not raise an error
    from app.core.config import settings
    user = crud.get_user_by_email(
        session=user_session,
        email=settings.FIRST_SUPERUSER,
    )
    
    assert user is not None
