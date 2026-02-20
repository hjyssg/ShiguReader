#!/usr/bin/env python3
"""CLI tool for building and maintaining the coser names database.

Usage:
    python build_coser_db.py --rebuild
    python build_coser_db.py --update
    python build_coser_db.py --add-alias "主名字" "别名"
    python build_coser_db.py --query "名字"
"""

from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from app.file_processing.name_parser.coser_db import CoserDatabase

# Default directories to scan
DEFAULT_SORTED_DIR = r"E:\_Happy_Picture\_Sorted_Picture"
DEFAULT_PICTURE_DIR = r"E:\_Happy_Picture\_Picture"


def create_database_schema(conn: sqlite3.Connection) -> None:
    """Create database tables and indexes.
    
    Args:
        conn: SQLite connection.
    """
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS coser (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            coser_id INTEGER NOT NULL,
            alias TEXT NOT NULL,
            UNIQUE (coser_id, alias)
        )
    """)
    
    # Create indexes
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_alias_name ON alias(alias)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_coser_name ON coser(name)
    """)
    
    conn.commit()
    print("✓ Database schema created")


def scan_sorted_directory(sorted_dir: Path) -> list[str]:
    """Scan the sorted directory for coser names.
    
    Args:
        sorted_dir: Path to the _Sorted_Picture directory.
    
    Returns:
        List of coser names (directory names).
    """
    if not sorted_dir.exists():
        print(f"⚠ Warning: Directory not found: {sorted_dir}")
        return []
    
    coser_names = []
    for entry in sorted_dir.iterdir():
        if entry.is_dir():
            coser_names.append(entry.name)
    
    print(f"✓ Found {len(coser_names)} coser directories in {sorted_dir}")
    return coser_names


def import_cosers(conn: sqlite3.Connection, coser_names: list[str]) -> int:
    """Import coser names into the database.
    
    Args:
        conn: SQLite connection.
        coser_names: List of coser names to import.
    
    Returns:
        Number of cosers imported.
    """
    cursor = conn.cursor()
    imported = 0
    
    for name in coser_names:
        try:
            cursor.execute(
                "INSERT OR IGNORE INTO coser (name) VALUES (?)",
                (name,)
            )
            if cursor.rowcount > 0:
                imported += 1
        except sqlite3.IntegrityError:
            # Already exists, skip
            pass
    
    conn.commit()
    print(f"✓ Imported {imported} new cosers ({len(coser_names) - imported} already existed)")
    return imported


def add_alias(conn: sqlite3.Connection, coser_name: str, alias: str) -> bool:
    """Add an alias for a coser.
    
    Args:
        conn: SQLite connection.
        coser_name: The main coser name.
        alias: The alias to add.
    
    Returns:
        True if alias was added, False otherwise.
    """
    cursor = conn.cursor()
    
    # Find the coser ID
    cursor.execute("SELECT id FROM coser WHERE LOWER(name) = ?", (coser_name.lower(),))
    row = cursor.fetchone()
    
    if not row:
        print(f"✗ Error: Coser '{coser_name}' not found in database")
        return False
    
    coser_id = row[0]
    
    try:
        cursor.execute(
            "INSERT INTO alias (coser_id, alias) VALUES (?, ?)",
            (coser_id, alias)
        )
        conn.commit()
        print(f"✓ Added alias '{alias}' for '{coser_name}'")
        return True
    except sqlite3.IntegrityError:
        print(f"⚠ Alias '{alias}' already exists for '{coser_name}'")
        return False


def rebuild_database(db_path: Path, sorted_dir: Path) -> None:
    """Rebuild the database from scratch.
    
    Args:
        db_path: Path to the database file.
        sorted_dir: Path to the _Sorted_Picture directory.
    """
    print("🔨 Rebuilding database...")
    
    # Remove existing database
    if db_path.exists():
        db_path.unlink()
        print(f"✓ Removed existing database: {db_path}")
    
    # Create new database
    conn = sqlite3.connect(db_path)
    try:
        create_database_schema(conn)
        
        # Scan and import
        coser_names = scan_sorted_directory(sorted_dir)
        import_cosers(conn, coser_names)
        
        print(f"\n✅ Database rebuilt successfully: {db_path}")
        print(f"   Total cosers: {len(coser_names)}")
    finally:
        conn.close()


def update_database(db_path: Path, sorted_dir: Path) -> None:
    """Update the database with new entries.
    
    Args:
        db_path: Path to the database file.
        sorted_dir: Path to the _Sorted_Picture directory.
    """
    print("🔄 Updating database...")
    
    if not db_path.exists():
        print("⚠ Database not found, creating new one...")
        rebuild_database(db_path, sorted_dir)
        return
    
    conn = sqlite3.connect(db_path)
    try:
        # Scan and import
        coser_names = scan_sorted_directory(sorted_dir)
        imported = import_cosers(conn, coser_names)
        
        print(f"\n✅ Database updated successfully")
        if imported == 0:
            print("   No new cosers to add")
    finally:
        conn.close()


def query_database(db_path: Path, name: str) -> None:
    """Query the database for a name.
    
    Args:
        db_path: Path to the database file.
        name: Name to query.
    """
    if not db_path.exists():
        print(f"✗ Error: Database not found: {db_path}")
        return
    
    with CoserDatabase(db_path) as db:
        # Try exact lookup
        main_name = db.lookup_coser(name)
        if main_name:
            print(f"\n✓ Found: '{name}' → '{main_name}'")
            
            # Show aliases
            aliases = db.get_aliases(main_name)
            if aliases:
                print(f"  Aliases: {', '.join(aliases)}")
        else:
            print(f"\n✗ Not found: '{name}'")
            
            # Try fuzzy match
            matches = db.fuzzy_match(name, limit=5)
            if matches:
                print(f"  Did you mean: {', '.join(matches)}")


def list_all_cosers(db_path: Path) -> None:
    """List all cosers in the database.
    
    Args:
        db_path: Path to the database file.
    """
    if not db_path.exists():
        print(f"✗ Error: Database not found: {db_path}")
        return
    
    with CoserDatabase(db_path) as db:
        cosers = db.get_all_cosers()
        print(f"\n📋 Total cosers: {len(cosers)}\n")
        for i, name in enumerate(cosers, 1):
            print(f"{i:3d}. {name}")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Build and maintain the coser names database"
    )
    
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Rebuild database from scratch"
    )
    
    parser.add_argument(
        "--update",
        action="store_true",
        help="Update database with new entries"
    )
    
    parser.add_argument(
        "--add-alias",
        nargs=2,
        metavar=("COSER_NAME", "ALIAS"),
        help="Add an alias for a coser"
    )
    
    parser.add_argument(
        "--query",
        metavar="NAME",
        help="Query database for a name"
    )
    
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all cosers"
    )
    
    parser.add_argument(
        "--db-path",
        type=Path,
        default=Path(__file__).parent / "coser_names.idx",
        help="Path to database file (default: coser_names.idx in current directory)"
    )
    
    parser.add_argument(
        "--sorted-dir",
        type=Path,
        default=Path(DEFAULT_SORTED_DIR),
        help=f"Path to _Sorted_Picture directory (default: {DEFAULT_SORTED_DIR})"
    )
    
    args = parser.parse_args()
    
    # Execute command
    if args.rebuild:
        rebuild_database(args.db_path, args.sorted_dir)
    elif args.update:
        update_database(args.db_path, args.sorted_dir)
    elif args.add_alias:
        conn = sqlite3.connect(args.db_path)
        try:
            add_alias(conn, args.add_alias[0], args.add_alias[1])
        finally:
            conn.close()
    elif args.query:
        query_database(args.db_path, args.query)
    elif args.list:
        list_all_cosers(args.db_path)
    else:
        parser.print_help()
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
