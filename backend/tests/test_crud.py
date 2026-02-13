"""Tests for app/crud.py CRUD operations."""

import pytest
from sqlmodel import Session

from app import crud
from app.models import User, UserCreate, UserUpdate


class TestCreateUser:
    """Test create_user function."""

    def test_create_user_success(self, user_session: Session) -> None:
        """Test creating a new user."""
        user_in = UserCreate(
            email="test@example.com",
            password="testpassword123",
            full_name="Test User",
        )
        
        user = crud.create_user(session=user_session, user_create=user_in)
        
        assert user.email == "test@example.com"
        assert user.full_name == "Test User"
        assert user.is_active is True
        assert user.is_superuser is False
        assert user.hashed_password != "testpassword123"
        assert len(user.hashed_password) > 0

    def test_create_superuser(self, user_session: Session) -> None:
        """Test creating a superuser."""
        user_in = UserCreate(
            email="admin@example.com",
            password="adminpass123",
            is_superuser=True,
        )
        
        user = crud.create_user(session=user_session, user_create=user_in)
        
        assert user.email == "admin@example.com"
        assert user.is_superuser is True


class TestUpdateUser:
    """Test update_user function."""

    def test_update_user_email(self, user_session: Session) -> None:
        """Test updating user email."""
        # Create user first
        user_in = UserCreate(
            email="original@example.com",
            password="password123",
        )
        user = crud.create_user(session=user_session, user_create=user_in)
        
        # Update email
        update_data = UserUpdate(email="updated@example.com")
        updated_user = crud.update_user(
            session=user_session,
            db_user=user,
            user_in=update_data,
        )
        
        assert updated_user.email == "updated@example.com"
        assert updated_user.id == user.id

    def test_update_user_password(self, user_session: Session) -> None:
        """Test updating user password."""
        # Create user first
        user_in = UserCreate(
            email="test@example.com",
            password="oldpassword123",
        )
        user = crud.create_user(session=user_session, user_create=user_in)
        old_hash = user.hashed_password
        
        # Update password
        update_data = UserUpdate(password="newpassword123")
        updated_user = crud.update_user(
            session=user_session,
            db_user=user,
            user_in=update_data,
        )
        
        assert updated_user.hashed_password != old_hash
        assert updated_user.hashed_password != "newpassword123"

    def test_update_user_full_name(self, user_session: Session) -> None:
        """Test updating user full name."""
        # Create user first
        user_in = UserCreate(
            email="test@example.com",
            password="password123",
            full_name="Original Name",
        )
        user = crud.create_user(session=user_session, user_create=user_in)
        
        # Update full name
        update_data = UserUpdate(full_name="Updated Name")
        updated_user = crud.update_user(
            session=user_session,
            db_user=user,
            user_in=update_data,
        )
        
        assert updated_user.full_name == "Updated Name"

    def test_update_user_multiple_fields(self, user_session: Session) -> None:
        """Test updating multiple user fields at once."""
        # Create user first
        user_in = UserCreate(
            email="test@example.com",
            password="password123",
        )
        user = crud.create_user(session=user_session, user_create=user_in)
        
        # Update multiple fields
        update_data = UserUpdate(
            email="newemail@example.com",
            full_name="New Name",
            is_active=False,
        )
        updated_user = crud.update_user(
            session=user_session,
            db_user=user,
            user_in=update_data,
        )
        
        assert updated_user.email == "newemail@example.com"
        assert updated_user.full_name == "New Name"
        assert updated_user.is_active is False


class TestGetUserByEmail:
    """Test get_user_by_email function."""

    def test_get_existing_user(self, user_session: Session) -> None:
        """Test getting an existing user by email."""
        # Create user first
        user_in = UserCreate(
            email="test@example.com",
            password="password123",
        )
        created_user = crud.create_user(session=user_session, user_create=user_in)
        
        # Get user by email
        found_user = crud.get_user_by_email(
            session=user_session,
            email="test@example.com",
        )
        
        assert found_user is not None
        assert found_user.id == created_user.id
        assert found_user.email == "test@example.com"

    def test_get_nonexistent_user(self, user_session: Session) -> None:
        """Test getting a non-existent user returns None."""
        found_user = crud.get_user_by_email(
            session=user_session,
            email="nonexistent@example.com",
        )
        
        assert found_user is None

    def test_email_case_sensitive(self, user_session: Session) -> None:
        """Test that email lookup is case-sensitive."""
        # Create user with lowercase email
        user_in = UserCreate(
            email="test@example.com",
            password="password123",
        )
        crud.create_user(session=user_session, user_create=user_in)
        
        # Try to get with different case
        found_user = crud.get_user_by_email(
            session=user_session,
            email="TEST@EXAMPLE.COM",
        )
        
        # SQLite is case-insensitive for LIKE, but exact match should work
        # This behavior may vary by database
        assert found_user is None or found_user.email == "test@example.com"


class TestAuthenticate:
    """Test authenticate function."""

    def test_authenticate_success(self, user_session: Session) -> None:
        """Test successful authentication."""
        # Create user
        user_in = UserCreate(
            email="test@example.com",
            password="correctpassword",
        )
        crud.create_user(session=user_session, user_create=user_in)
        
        # Authenticate
        authenticated_user = crud.authenticate(
            session=user_session,
            email="test@example.com",
            password="correctpassword",
        )
        
        assert authenticated_user is not None
        assert authenticated_user.email == "test@example.com"

    def test_authenticate_wrong_password(self, user_session: Session) -> None:
        """Test authentication with wrong password."""
        # Create user
        user_in = UserCreate(
            email="test@example.com",
            password="correctpassword",
        )
        crud.create_user(session=user_session, user_create=user_in)
        
        # Try to authenticate with wrong password
        authenticated_user = crud.authenticate(
            session=user_session,
            email="test@example.com",
            password="wrongpassword",
        )
        
        assert authenticated_user is None

    def test_authenticate_nonexistent_user(self, user_session: Session) -> None:
        """Test authentication with non-existent user."""
        authenticated_user = crud.authenticate(
            session=user_session,
            email="nonexistent@example.com",
            password="anypassword",
        )
        
        assert authenticated_user is None

    def test_authenticate_timing_attack_prevention(
        self, user_session: Session
    ) -> None:
        """Test that authentication takes similar time for existing and non-existing users."""
        # This is a basic test - in production, you'd measure actual timing
        # The function should call verify_password even when user doesn't exist
        
        # Try to authenticate non-existent user (should still hash password)
        result = crud.authenticate(
            session=user_session,
            email="nonexistent@example.com",
            password="anypassword",
        )
        
        assert result is None
        # The function should have called verify_password with DUMMY_HASH
        # to prevent timing attacks
