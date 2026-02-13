#!/usr/bin/env python3
"""
Migrate data from old ShiguReader database to new project.

This script migrates:
1. History data from history_table to progress table
2. Converts millisecond timestamps to seconds
3. Deduplicates entries (keeps latest per filepath)
"""

import sqlite3
import sys
from pathlib import Path

# Old database path
OLD_DB_PATH = r"D:\Git\ShiguReader\packages\backend\workspace\shigureader_internal_db.sqlite"

# New database path (relative to project root)
NEW_DB_PATH = Path(__file__).parent.parent.parent / "data" / "index.db"


def migrate_history():
    """Migrate history data from old DB to new DB."""
    print(f"Connecting to old database: {OLD_DB_PATH}")
    old_conn = sqlite3.connect(OLD_DB_PATH)
    old_cursor = old_conn.cursor()

    print(f"Connecting to new database: {NEW_DB_PATH}")
    NEW_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    new_conn = sqlite3.connect(NEW_DB_PATH)
    new_cursor = new_conn.cursor()

    # Fetch all history records from old DB
    print("Fetching history records from old database...")
    old_cursor.execute("""
        SELECT filePath, fileName, time 
        FROM history_table 
        ORDER BY time DESC
    """)
    
    records = old_cursor.fetchall()
    print(f"Found {len(records)} history records")

    # Deduplicate: keep only the latest record for each filepath
    seen_paths = set()
    unique_records = []
    for filepath, filename, time_ms in records:
        if filepath not in seen_paths:
            seen_paths.add(filepath)
            unique_records.append((filepath, filename, time_ms))
    
    print(f"After deduplication: {len(unique_records)} unique records")

    # Insert into new database
    print("Inserting records into new database...")
    inserted = 0
    skipped = 0
    
    for filepath, filename, time_ms in unique_records:
        # Convert millisecond timestamp to seconds
        time_sec = int(time_ms / 1000)
        
        # Check if file exists
        file_exists = Path(filepath).exists()
        
        try:
            # Insert or replace into progress table
            new_cursor.execute("""
                INSERT OR REPLACE INTO progress 
                (filepath, filename, last_opened_at, updated_at)
                VALUES (?, ?, ?, ?)
            """, (filepath, filename, time_sec, time_sec))
            inserted += 1
            
            if inserted % 1000 == 0:
                print(f"  Inserted {inserted} records...")
                new_conn.commit()
        except Exception as e:
            print(f"  Error inserting {filepath}: {e}")
            skipped += 1

    new_conn.commit()
    print(f"\nMigration complete!")
    print(f"  Inserted: {inserted}")
    print(f"  Skipped: {skipped}")

    old_conn.close()
    new_conn.close()


def main():
    """Main entry point."""
    if not Path(OLD_DB_PATH).exists():
        print(f"Error: Old database not found at {OLD_DB_PATH}")
        sys.exit(1)

    print("=" * 60)
    print("ShiguReader Data Migration")
    print("=" * 60)
    print()

    try:
        migrate_history()
        print("\n✓ Migration successful!")
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
