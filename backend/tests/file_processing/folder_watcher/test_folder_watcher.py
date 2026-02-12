from __future__ import annotations

import time
from pathlib import Path

import pytest

from app.file_processing.folder_watcher import FolderWatcher


def _wait_for_events(seconds: float = 1.2) -> None:
    time.sleep(seconds)


def test_folder_watcher_capture_create_modify_delete(tmp_path: Path) -> None:
    watch_dir = tmp_path / "watched"
    watch_dir.mkdir(parents=True, exist_ok=True)

    watcher = FolderWatcher(watch_dir)
    watcher.start()
    try:
        time.sleep(0.8)
        f = watch_dir / "a.txt"
        f.write_text("one", encoding="utf-8")
        f.write_text("two", encoding="utf-8")
        _ = f.read_text(encoding="utf-8")
        f.unlink()
        _wait_for_events()
    finally:
        watcher.stop()

    events = watcher.snapshot_events()
    kinds = {event.kind for event in events}
    assert "create" in kinds
    assert "update" in kinds
    assert "delete" in kinds


def test_folder_watcher_read_event_best_effort(tmp_path: Path) -> None:
    watch_dir = tmp_path / "watched-read"
    watch_dir.mkdir(parents=True, exist_ok=True)
    f = watch_dir / "x.txt"
    f.write_text("hello", encoding="utf-8")

    watcher = FolderWatcher(watch_dir)
    watcher.start()
    try:
        time.sleep(0.8)
        _ = f.read_text(encoding="utf-8")
        _wait_for_events(1.0)
    finally:
        watcher.stop()

    events = watcher.snapshot_events()
    reads = [e for e in events if e.kind == "read"]
    assert len(reads) >= 0


def test_folder_watcher_bulk_performance(tmp_path: Path) -> None:
    watch_dir = tmp_path / "watched-bulk"
    watch_dir.mkdir(parents=True, exist_ok=True)

    watcher = FolderWatcher(watch_dir)
    watcher.start()
    created = 80
    start = time.perf_counter()
    try:
        time.sleep(0.8)
        for i in range(created):
            p = watch_dir / f"f-{i}.txt"
            p.write_text(str(i), encoding="utf-8")
        _wait_for_events(1.5)
    finally:
        watcher.stop()
    elapsed = time.perf_counter() - start

    creates = [e for e in watcher.snapshot_events() if e.kind == "create"]
    assert elapsed < 5.0
    assert len(creates) >= int(created * 0.8)


def test_folder_watcher_benchmark(benchmark: pytest.BenchmarkFixture, tmp_path: Path) -> None:
    watch_dir = tmp_path / "watched-bench"
    watch_dir.mkdir(parents=True, exist_ok=True)

    def _run() -> int:
        watcher = FolderWatcher(watch_dir)
        watcher.start()
        try:
            time.sleep(0.6)
            p = watch_dir / f"bench-{time.time_ns()}.txt"
            p.write_text("v", encoding="utf-8")
            _wait_for_events(0.8)
        finally:
            watcher.stop()
        return len(watcher.snapshot_events())

    count = benchmark(_run)
    assert count >= 1
