from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

from app.core.config import settings
from app.index_db.db import ensure_sqlite_parent_dir_exists


def _build_alembic_config(index_db_url: str) -> Config:
    config = Config()
    script_location = Path(__file__).resolve().parent / "alembic"
    config.set_main_option("script_location", str(script_location))
    config.set_main_option("sqlalchemy.url", index_db_url)
    return config


def ensure_index_db_initialized(index_db_url: str | None = None) -> None:
    db_url = index_db_url or settings.INDEX_SQLITE_URL
    ensure_sqlite_parent_dir_exists(db_url)
    config = _build_alembic_config(db_url)
    command.upgrade(config, "head")
