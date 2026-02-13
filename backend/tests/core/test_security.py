"""Tests for app/core/security.py password hashing and verification."""

import pytest

from app.core.security import get_password_hash, verify_password


class TestGetPasswordHash:
    """Test get_password_hash function."""

    def test_hash_password(self) -> None:
        """Test that password is hashed."""
        password = "testpassword123"
        hashed = get_password_hash(password)
        
        assert hashed != password
        assert len(hashed) > 0
        assert isinstance(hashed, str)

    def test_different_hashes_for_same_password(self) -> None:
        """Test that same password produces different hashes (due to salt)."""
        password = "testpassword123"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)
        
        # Hashes should be different due to random salt
        assert hash1 != hash2

    def test_hash_empty_password(self) -> None:
        """Test hashing empty password."""
        hashed = get_password_hash("")
        assert len(hashed) > 0

    def test_hash_long_password(self) -> None:
        """Test hashing very long password."""
        password = "a" * 1000
        hashed = get_password_hash(password)
        assert len(hashed) > 0

    def test_hash_special_characters(self) -> None:
        """Test hashing password with special characters."""
        password = "p@ssw0rd!#$%^&*()"
        hashed = get_password_hash(password)
        assert len(hashed) > 0


class TestVerifyPassword:
    """Test verify_password function."""

    def test_verify_correct_password(self) -> None:
        """Test verifying correct password."""
        password = "testpassword123"
        hashed = get_password_hash(password)
        
        verified, updated_hash = verify_password(password, hashed)
        
        assert verified is True
        # No update needed for fresh hash
        assert updated_hash is None

    def test_verify_wrong_password(self) -> None:
        """Test verifying wrong password."""
        password = "testpassword123"
        wrong_password = "wrongpassword456"
        hashed = get_password_hash(password)
        
        verified, updated_hash = verify_password(wrong_password, hashed)
        
        assert verified is False
        assert updated_hash is None

    def test_verify_empty_password(self) -> None:
        """Test verifying empty password."""
        password = "testpassword123"
        hashed = get_password_hash(password)
        
        verified, updated_hash = verify_password("", hashed)
        
        assert verified is False

    def test_verify_case_sensitive(self) -> None:
        """Test that password verification is case-sensitive."""
        password = "TestPassword123"
        hashed = get_password_hash(password)
        
        # Try with different case
        verified, _ = verify_password("testpassword123", hashed)
        assert verified is False
        
        # Correct case should work
        verified, _ = verify_password("TestPassword123", hashed)
        assert verified is True

    def test_verify_special_characters(self) -> None:
        """Test verifying password with special characters."""
        password = "p@ssw0rd!#$%^&*()"
        hashed = get_password_hash(password)
        
        verified, updated_hash = verify_password(password, hashed)
        
        assert verified is True
        assert updated_hash is None

    def test_verify_returns_tuple(self) -> None:
        """Test that verify_password returns a tuple."""
        password = "testpassword123"
        hashed = get_password_hash(password)
        
        result = verify_password(password, hashed)
        
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], bool)
        # Second element can be None or str
        assert result[1] is None or isinstance(result[1], str)


class TestPasswordHashingIntegration:
    """Integration tests for password hashing workflow."""

    def test_hash_and_verify_workflow(self) -> None:
        """Test complete hash and verify workflow."""
        original_password = "mySecurePassword123!"
        
        # Hash the password
        hashed = get_password_hash(original_password)
        
        # Verify correct password
        verified, _ = verify_password(original_password, hashed)
        assert verified is True
        
        # Verify wrong password
        verified, _ = verify_password("wrongPassword", hashed)
        assert verified is False

    def test_multiple_users_same_password(self) -> None:
        """Test that same password for different users produces different hashes."""
        password = "commonPassword123"
        
        # Simulate two users with same password
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)
        
        # Hashes should be different
        assert hash1 != hash2
        
        # But both should verify correctly
        verified1, _ = verify_password(password, hash1)
        verified2, _ = verify_password(password, hash2)
        
        assert verified1 is True
        assert verified2 is True
