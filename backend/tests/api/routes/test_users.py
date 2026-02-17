"""Tests for app/api/routes/users.py user management endpoints."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.models import UserCreate


def test_read_users_as_superuser(client: TestClient, user_session: Session) -> None:
    """Test reading users list as superuser."""
    # Create a superuser
    superuser = crud.create_user(
        session=user_session,
        user_create=UserCreate(
            email="admin@example.com",
            password="adminpass123",
            is_superuser=True,
        ),
    )
    
    response = client.get("/api/v1/users/")
    
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "count" in data
    assert data["count"] >= 1


def test_create_user_as_superuser(client: TestClient, user_session: Session) -> None:
    """Test creating a new user as superuser."""
    # Create superuser first
    crud.create_user(
        session=user_session,
        user_create=UserCreate(
            email="admin@example.com",
            password="adminpass123",
            is_superuser=True,
        ),
    )
    
    response = client.post(
        "/api/v1/users/",
        json={
            "email": "newuser@example.com",
            "password": "newpass123",
            "full_name": "New User",
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New User"


def test_create_user_duplicate_email(client: TestClient, user_session: Session) -> None:
    """Test creating user with duplicate email fails."""
    # Create superuser
    crud.create_user(
        session=user_session,
        user_create=UserCreate(
            email="admin@example.com",
            password="adminpass123",
            is_superuser=True,
        ),
    )
    
    # Create first user
    crud.create_user(
        session=user_session,
        user_create=UserCreate(
            email="existing@example.com",
            password="pass1234",
        ),
    )
    
    # Try to create duplicate
    response = client.post(
        "/api/v1/users/",
        json={
            "email": "existing@example.com",
            "password": "pass1234",
        },
    )
    
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]




def test_register_user(client: TestClient, user_session: Session) -> None:
    """Test user registration endpoint."""
    response = client.post(
        "/api/v1/users/signup",
        json={
            "email": "newuser@example.com",
            "password": "newpass123",
            "full_name": "New User",
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New User"


def test_register_user_duplicate_email(client: TestClient, user_session: Session) -> None:
    """Test registration with duplicate email fails."""
    crud.create_user(
        session=user_session,
        user_create=UserCreate(
            email="existing@example.com",
            password="pass1234",
        ),
    )
    
    response = client.post(
        "/api/v1/users/signup",
        json={
            "email": "existing@example.com",
            "password": "pass1234",
        },
    )
    
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_read_user_by_id(client: TestClient, user_session: Session) -> None:
    """Test reading user by ID."""
    user = crud.create_user(
        session=user_session,
        user_create=UserCreate(
            email="test@example.com",
            password="testpass123",
        ),
    )
    
    response = client.get(f"/api/v1/users/{user.id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"


def test_read_user_by_id_not_found(client: TestClient, user_session: Session) -> None:
    """Test non-superuser reading others returns 403 before not-found check."""
    crud.create_user(
        session=user_session,
        user_create=UserCreate(
            email="test@example.com",
            password="testpass123",
        ),
    )
    
    response = client.get("/api/v1/users/00000000-0000-0000-0000-000000000000")
    
    assert response.status_code == 403


