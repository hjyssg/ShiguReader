from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, create_engine

from app.core.config import settings


def ensure_sqlite_parent_dir_exists(index_db_url: str) -> None:
    if not index_db_url.startswith("sqlite:///"):
        return
    db_path = index_db_url.removeprefix("sqlite:///")
    if db_path in {":memory:", ""}:
        return
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)


def _register_sqlite_pragma(engine: Engine) -> None:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection: object, _: object) -> None:  # noqa: ANN001
        cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
        cursor.execute("PRAGMA foreign_keys = ON")
        # Improve read/write concurrency and reduce request stalls under scan/migration load.
        cursor.execute("PRAGMA journal_mode = WAL")
        cursor.execute("PRAGMA synchronous = NORMAL")
        cursor.execute("PRAGMA busy_timeout = 5000")
        cursor.close()


@lru_cache(maxsize=4)
def _engine_by_url(index_db_url: str) -> Engine:
    ensure_sqlite_parent_dir_exists(index_db_url)
    connect_args: dict[str, object] = {}
    if index_db_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    engine = create_engine(index_db_url, connect_args=connect_args)
    if index_db_url.startswith("sqlite"):
        _register_sqlite_pragma(engine)
    return engine


def get_index_engine() -> Engine:
    return _engine_by_url(settings.INDEX_SQLITE_URL)


def clear_index_engine_cache() -> None:
    _engine_by_url.cache_clear()


@contextmanager
def get_index_session() -> Iterator[Session]:
    with Session(get_index_engine()) as session:
        yield session
