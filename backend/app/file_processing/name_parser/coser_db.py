"""Coser database module for name lookup and normalization.

This module provides database operations for coser  name management,
including lookup by alias and fuzzy matching.

Uses Aho-Corasick algorithm for efficient batch matching when available.
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Any

try:
    import ahocorasick
    HAS_AHOCORASICK = True
except ImportError:
    HAS_AHOCORASICK = False

# Database path - same directory as this file
_DB_PATH = Path(__file__).parent / "coser_names.idx"


class CoserDatabase:
    """Coser database manager for name lookups."""

    def __init__(self, db_path: Path | str | None = None):
        """Initialize database connection.
        
        Args:
            db_path: Path to the SQLite database file. If None, uses default path.
        """
        self.db_path = Path(db_path) if db_path else _DB_PATH
        self._conn: sqlite3.Connection | None = None
        self._automaton: Any | None = None  # ahocorasick.Automaton
    
    def __enter__(self):
        """Context manager entry."""
        self._conn = sqlite3.connect(self.db_path)
        self._conn.row_factory = sqlite3.Row
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        if self._conn:
            self._conn.close()
            self._conn = None
    
    def _get_connection(self) -> sqlite3.Connection:
        """Get or create database connection."""
        if self._conn is None:
            self._conn = sqlite3.connect(self.db_path)
            self._conn.row_factory = sqlite3.Row
        return self._conn
    
    def close(self) -> None:
        """Close database connection."""
        if self._conn:
            self._conn.close()
            self._conn = None
    
    def _build_automaton(self) -> Any:
        """Build Aho-Corasick automaton for efficient pattern matching.
        
        Returns:
            ahocorasick.Automaton or None if library not available.
        """
        if not HAS_AHOCORASICK:
            return None
        
        # 如果已经构建过，直接返回缓存的automaton
        if self._automaton is not None:
            return self._automaton
        
        if not self.db_path.exists():
            return None
        
        # Create automaton
        A = ahocorasick.Automaton()
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # Add all coser names (case-insensitive)
        cursor.execute("SELECT id, name FROM coser")
        for row in cursor.fetchall():
            coser_id = row["id"]
            name = row["name"]
            # Store both original and lowercase versions
            A.add_word(name.lower(), (coser_id, name))
        
        # Add all aliases
        cursor.execute("""
            SELECT a.alias, c.id, c.name
            FROM alias a
            JOIN coser c ON a.coser_id = c.id
        """)
        for row in cursor.fetchall():
            alias = row["alias"]
            coser_id = row["id"]
            main_name = row["name"]
            A.add_word(alias.lower(), (coser_id, main_name))
        
        # Build automaton (这个操作只做一次)
        A.make_automaton()
        
        # 缓存automaton，避免重复构建
        self._automaton = A
        return A
    
    def find_cosers_in_text(self, text: str) -> list[str]:
        """Find all matching coser names in text using Aho-Corasick algorithm.
        
        This is more efficient than calling lookup_coser() multiple times.
        
        Args:
            text: The text to search in (e.g., filename).
        
        Returns:
            List of unique main coser names found in the text (deduplicated).
        """
        if not HAS_AHOCORASICK:
            # Fallback to basic lookup if ahocorasick not available
            return []
        
        A = self._build_automaton()
        if not A:
            return []
        
        text_lower = text.lower()
        found_cosers: dict[int, str] = {}  # coser_id -> main_name
        
        for end_index, (coser_id, main_name) in A.iter(text_lower):
            found_cosers[coser_id] = main_name
        
        return list(found_cosers.values())
    
    def batch_lookup(self, names: list[str]) -> dict[str, str | None]:
        """Batch lookup multiple names efficiently.
        
        Args:
            names: List of names to look up.
        
        Returns:
            Dictionary mapping input names to their main coser names.
        """
        results = {}
        for name in names:
            results[name] = self.lookup_coser(name)
        return results
    
    def lookup_coser(self, name: str) -> str | None:
        """Look up the main coser name by alias or exact name.
        
        Args:
            name: The name or alias to look up.
        
        Returns:
            The main coser name if found, None otherwise.
        """
        if not name or not self.db_path.exists():
            return None
        
        name_lower = name.lower().strip()
        if not name_lower:
            return None
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # First try exact match on main name
        cursor.execute(
            "SELECT name FROM coser WHERE LOWER(name) = ?",
            (name_lower,)
        )
        row = cursor.fetchone()
        if row:
            return row["name"]
        
        # Then try alias lookup
        cursor.execute(
            """
            SELECT c.name 
            FROM coser c
            JOIN alias a ON c.id = a.coser_id
            WHERE LOWER(a.alias) = ?
            """,
            (name_lower,)
        )
        row = cursor.fetchone()
        if row:
            return row["name"]
        
        return None
    
    def get_aliases(self, coser_name: str) -> list[str]:
        """Get all aliases for a coser.
        
        Args:
            coser_name: The main coser name.
        
        Returns:
            List of aliases for this coser.
        """
        if not coser_name or not self.db_path.exists():
            return []
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """
            SELECT a.alias
            FROM coser c
            JOIN alias a ON c.id = a.coser_id
            WHERE LOWER(c.name) = ?
            ORDER BY a.alias
            """,
            (coser_name.lower().strip(),)
        )
        
        return [row["alias"] for row in cursor.fetchall()]
    
    def fuzzy_match(self, name: str, limit: int = 10) -> list[str]:
        """Fuzzy match coser names.
        
        Args:
            name: The name to search for.
            limit: Maximum number of results.
        
        Returns:
            List of matching coser names.
        """
        if not name or not self.db_path.exists():
            return []
        
        pattern = f"%{name.lower().strip()}%"
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # Search in both main names and aliases
        cursor.execute(
            """
            SELECT DISTINCT c.name
            FROM coser c
            LEFT JOIN alias a ON c.id = a.coser_id
            WHERE LOWER(c.name) LIKE ? OR LOWER(a.alias) LIKE ?
            ORDER BY c.name
            LIMIT ?
            """,
            (pattern, pattern, limit)
        )
        
        return [row["name"] for row in cursor.fetchall()]
    
    def get_all_cosers(self) -> list[str]:
        """Get all coser names in the database.
        
        Returns:
            List of all coser names.
        """
        if not self.db_path.exists():
            return []
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM coser ORDER BY name")
        return [row["name"] for row in cursor.fetchall()]


# Module-level convenience functions using a shared connection
_global_db: CoserDatabase | None = None


def _get_global_db() -> CoserDatabase:
    """Get or create the global database instance."""
    global _global_db
    if _global_db is None:
        _global_db = CoserDatabase()
    return _global_db


def lookup_coser(name: str) -> str | None:
    """Look up the main coser name by alias or exact name.
    
    This is a convenience function that uses a module-level database connection.
    
    Args:
        name: The name or alias to look up.
    
    Returns:
        The main coser name if found, None otherwise.
    """
    return _get_global_db().lookup_coser(name)


def find_cosers_in_text(text: str) -> list[str]:
    """Find all matching coser names in text using Aho-Corasick algorithm.
    
    This is a convenience function that uses a module-level database connection.
    More efficient than calling lookup_coser() multiple times.
    
    Args:
        text: The text to search in (e.g., filename).
    
    Returns:
        List of unique main coser names found in the text.
    """
    return _get_global_db().find_cosers_in_text(text)


def batch_lookup(names: list[str]) -> dict[str, str | None]:
    """Batch lookup multiple names efficiently.
    
    This is a convenience function that uses a module-level database connection.
    
    Args:
        names: List of names to look up.
    
    Returns:
        Dictionary mapping input names to their main coser names.
    """
    return _get_global_db().batch_lookup(names)


def get_aliases(coser_name: str) -> list[str]:
    """Get all aliases for a coser.
    
    This is a convenience function that uses a module-level database connection.
    
    Args:
        coser_name: The main coser name.
    
    Returns:
        List of aliases for this coser.
    """
    return _get_global_db().get_aliases(coser_name)


def fuzzy_match(name: str, limit: int = 10) -> list[str]:
    """Fuzzy match coser names.
    
    This is a convenience function that uses a module-level database connection.
    
    Args:
        name: The name to search for.
        limit: Maximum number of results.
    
    Returns:
        List of matching coser names.
    """
    return _get_global_db().fuzzy_match(name, limit)
