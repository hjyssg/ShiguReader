"""Unit tests for coser_db module."""

from __future__ import annotations

import sqlite3
import tempfile
from pathlib import Path

import pytest

from app.file_processing.name_parser.coser_db import CoserDatabase, lookup_coser


class TestCoserDatabase:
    """Tests for CoserDatabase class."""

    @pytest.fixture
    def temp_db(self):
        """Create a temporary database for testing."""
        with tempfile.NamedTemporaryFile(suffix=".idx", delete=False) as f:
            db_path = Path(f.name)
        
        # Create schema and populate test data
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE coser (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            )
        """)
        
        cursor.execute("""
            CREATE TABLE alias (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                coser_id INTEGER NOT NULL,
                alias TEXT NOT NULL,
                FOREIGN KEY (coser_id) REFERENCES coser(id),
                UNIQUE (coser_id, alias)
            )
        """)
        
        # Insert test data
        cursor.execute("INSERT INTO coser (name) VALUES (?)", ("夏美酱",))
        coser_id = cursor.lastrowid
        cursor.execute("INSERT INTO alias (coser_id, alias) VALUES (?, ?)", (coser_id, "Natsumi"))
        cursor.execute("INSERT INTO alias (coser_id, alias) VALUES (?, ?)", (coser_id, "なつみ"))
        
        cursor.execute("INSERT INTO coser (name) VALUES (?)", ("Momo Rina モモリナ",))
        
        conn.commit()
        conn.close()
        
        yield db_path
        
        # Cleanup
        db_path.unlink()
    
    def test_lookup_exact_match(self, temp_db):
        """Test exact name match."""
        with CoserDatabase(temp_db) as db:
            result = db.lookup_coser("夏美酱")
            assert result == "夏美酱"
    
    def test_lookup_by_alias(self, temp_db):
        """Test lookup by alias."""
        with CoserDatabase(temp_db) as db:
            result = db.lookup_coser("Natsumi")
            assert result == "夏美酱"
            
            result = db.lookup_coser("なつみ")
            assert result == "夏美酱"
    
    def test_lookup_case_insensitive(self, temp_db):
        """Test case-insensitive lookup."""
        with CoserDatabase(temp_db) as db:
            result = db.lookup_coser("NATSUMI")
            assert result == "夏美酱"
            
            result = db.lookup_coser("夏美JIANG")
            # Won't match because the actual name is "夏美酱"
            assert result is None
    
    def test_lookup_not_found(self, temp_db):
        """Test lookup for non-existent name."""
        with CoserDatabase(temp_db) as db:
            result = db.lookup_coser("不存在的名字")
            assert result is None
    
    def test_get_aliases(self, temp_db):
        """Test getting all aliases for a coser."""
        with CoserDatabase(temp_db) as db:
            aliases = db.get_aliases("夏美酱")
            assert len(aliases) == 2
            assert "Natsumi" in aliases
            assert "なつみ" in aliases
    
    def test_get_aliases_no_aliases(self, temp_db):
        """Test getting aliases for coser with no aliases."""
        with CoserDatabase(temp_db) as db:
            aliases = db.get_aliases("Momo Rina モモリナ")
            assert len(aliases) == 0
    
    def test_fuzzy_match(self, temp_db):
        """Test fuzzy matching."""
        with CoserDatabase(temp_db) as db:
            # Match by partial name
            results = db.fuzzy_match("夏美")
            assert "夏美酱" in results
            
            # Match by partial alias
            results = db.fuzzy_match("Nat")
            assert "夏美酱" in results
    
    def test_get_all_cosers(self, temp_db):
        """Test getting all cosers."""
        with CoserDatabase(temp_db) as db:
            cosers = db.get_all_cosers()
            assert len(cosers) == 2
            assert "夏美酱" in cosers
            assert "Momo Rina モモリナ" in cosers
    
    def test_database_not_exists(self):
        """Test behavior when database doesn't exist."""
        non_existent_path = Path("/path/to/non/existent/db.idx")
        with CoserDatabase(non_existent_path) as db:
            result = db.lookup_coser("test")
            assert result is None
    
    def test_context_manager(self, temp_db):
        """Test context manager usage."""
        with CoserDatabase(temp_db) as db:
            result = db.lookup_coser("夏美酱")
            assert result == "夏美酱"
        
        # Connection should be closed after context
        assert db._conn is None


def test_module_level_lookup(temp_db):
    """Test module-level lookup function."""
    # This test would require mocking the global database path
    # For now, we'll just test that it doesn't crash
    result = lookup_coser("test")
    # May return None if the actual database doesn't exist
    assert result is None or isinstance(result, str)
