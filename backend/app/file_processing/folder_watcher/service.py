from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from pathlib import Path

from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer


@dataclass(slots=True)
class FileEvent:
    kind: str
    path: str
    is_directory: bool
    timestamp: float


class _Handler(FileSystemEventHandler):
    def __init__(self, sink: list[FileEvent], lock: threading.Lock) -> None:
        self._sink = sink
        self._lock = lock

    def _append(self, kind: str, event: FileSystemEvent) -> None:
        with self._lock:
            self._sink.append(
                FileEvent(
                    kind=kind,
                    path=event.src_path,
                    is_directory=event.is_directory,
                    timestamp=time.time(),
                )
            )

    def on_created(self, event: FileSystemEvent) -> None:
        self._append("create", event)

    def on_modified(self, event: FileSystemEvent) -> None:
        self._append("update", event)

    def on_deleted(self, event: FileSystemEvent) -> None:
        self._append("delete", event)

    def on_opened(self, event: FileSystemEvent) -> None:
        self._append("read", event)


class FolderWatcher:
    def __init__(self, watch_dir: str | Path) -> None:
        self.watch_dir = Path(watch_dir)
        self._events: list[FileEvent] = []
        self._lock = threading.Lock()
        self._observer = Observer()
        self._handler = _Handler(self._events, self._lock)
        self._started = False

    def start(self) -> None:
        if self._started:
            return
        self.watch_dir.mkdir(parents=True, exist_ok=True)
        self._observer.schedule(self._handler, str(self.watch_dir), recursive=True)
        self._observer.start()
        self._started = True

    def stop(self) -> None:
        if not self._started:
            return
        self._observer.stop()
        self._observer.join(timeout=3)
        self._started = False

    def snapshot_events(self) -> list[FileEvent]:
        with self._lock:
            return list(self._events)
