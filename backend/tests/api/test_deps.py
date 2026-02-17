"""Tests for app/api/deps.py dependency injection."""

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError
from sqlmodel import Session

from app import crud
from app.api.deps import get_current_user, get_db
from app.models import UserCreate


def test_get_db(user_session: Session) -> None:
    """Test get_db dependency returns a session."""
    # get_db is a generator, so we need to call next() on it
    db_gen = get_db()
    session = next(db_gen)
    
    assert session is not None
    assert isinstance(session, Session)


def test_get_current_user_returns_first_user(user_session: Session) -> None:
    """Test get_current_user returns the first created user."""
    # Create a user
    user = crud.create_user(
        session=user_session,
        user_create=UserCreate(
            email="test@example.com",
            password="testpass123",
        ),
    )
    
    # Get current user
    current_user = get_current_user(user_session)
    
    assert current_user is not None
    assert current_user.email == "test@example.com"


def test_get_current_user_no_user_raises_503(user_session: Session) -> None:
    """Test get_current_user raises 503 when no user exists."""
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(user_session)
    
    assert exc_info.value.status_code == 503
    assert "No user available" in exc_info.value.detail


def test_get_current_user_inactive_user_raises_400(user_session: Session) -> None:
    """Test get_current_user raises 400 for inactive user."""
    # Create an inactive user
    crud.create_user(
        session=user_session,
        user_create=UserCreate(
            email="inactive@example.com",
            password="testpass123",
            is_active=False,
        ),
    )
    
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(user_session)
    
    assert exc_info.value.status_code == 400
    assert "Inactive user" in exc_info.value.detail


def test_get_current_user_fallback_when_missing_created_at_column() -> None:
    """兼容旧库：第一次按 created_at 查询失败时回退到 id 排序。"""

    class _Result:
        def __init__(self, user):
            self._user = user

        def first(self):
            return self._user

    class _SessionStub:
        def __init__(self, user):
            self.user = user
            self.calls = 0

        def exec(self, _stmt):
            self.calls += 1
            if self.calls == 1:
                raise OperationalError("SELECT ...", {}, Exception("no such column"))
            return _Result(self.user)

    class _UserStub:
        email = "compat@example.com"
        is_active = True

    user = _UserStub()
    session_stub = _SessionStub(user)

    current_user = get_current_user(session_stub)

    assert current_user.email == "compat@example.com"
    assert session_stub.calls == 2
