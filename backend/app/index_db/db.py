from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path
import threading

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, create_engine

from app.core.config import settings


_index_write_lock = threading.RLock()  # 串行化写入，降低 sqlite 锁冲突


def ensure_sqlite_parent_dir_exists(index_db_url: str) -> None:
    """当使用 sqlite 文件库时，确保数据库目录存在。"""
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
        cursor.execute("PRAGMA foreign_keys = OFF")
        # Improve read/write concurrency and reduce request stalls under scan/migration load.
        cursor.execute("PRAGMA journal_mode = WAL")
        cursor.execute("PRAGMA synchronous = NORMAL")
        # Stability-first: prefer waiting over immediate "database is locked" errors.
        cursor.execute("PRAGMA busy_timeout = 30000")
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
    """获取索引库 Engine（按 URL 缓存）。"""
    return _engine_by_url(settings.INDEX_SQLITE_URL)


def clear_index_engine_cache() -> None:
    """清理 Engine 缓存，便于测试或配置切换。"""
    _engine_by_url.cache_clear()


@contextmanager
def index_write_guard() -> Iterator[None]:
    """Serialize all index-db writes to avoid SQLite lock contention.

    This intentionally trades write throughput for stability.
    """
    with _index_write_lock:
        yield


@contextmanager
def get_index_session() -> Iterator[Session]:
    """创建索引库会话上下文。"""
    with Session(get_index_engine()) as session:
        yield session
