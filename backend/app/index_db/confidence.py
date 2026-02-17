from __future__ import annotations

from time import time
from typing import Literal

ConfidenceLevel = Literal["certain", "likely_present", "uncertain"]

SCAN_FRESH_WINDOW_SEC = 600  # 10 分钟内扫描结果视为“较新”


def compute_confidence(
    *,
    scan_state: int,
    watch_state: int,
    last_seen_at: int | None,
    now_ts: int | None = None,
) -> tuple[ConfidenceLevel, float]:
    """根据扫描/监听状态计算存在置信度。"""
    now = now_ts if now_ts is not None else int(time())

    if watch_state == 1:
        return "certain", 1.0

    if scan_state == 1 and last_seen_at is not None and now - last_seen_at <= SCAN_FRESH_WINDOW_SEC:
        return "likely_present", 0.7

    return "uncertain", 0.2


def is_scanned_recent(last_seen_at: int | None, now_ts: int | None = None) -> bool:
    """判断文件是否在“最近扫描窗口”内被发现。"""
    if last_seen_at is None:
        return False
    now = now_ts if now_ts is not None else int(time())
    return now - last_seen_at <= SCAN_FRESH_WINDOW_SEC
