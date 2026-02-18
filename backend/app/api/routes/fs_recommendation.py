from __future__ import annotations

import logging
import math
import threading
from pathlib import Path

from app.core.config import settings
from app.index_db.repository import IndexRepository

logger = logging.getLogger(__name__)

# 推荐分数内存缓存（避免每次 list 都查 DB）
_rec_cache_lock = threading.Lock()
_rec_cache: dict[str, object] = {
    "author_freq": {},   # dict[str, int]  作者在 favorite 中出现次数
    "tag_freq": {},      # dict[str, int]  标签在 favorite 中出现次数
    "tag_total": {},     # dict[str, int]  标签全局总数
    "initialized": False,
}


def compute_rec_score_for_file(
    authors: list[str],
    tags: list[str],
    author_freq: dict[str, int],
    tag_freq: dict[str, int],
    tag_total: dict[str, int],
) -> float:
    """纯计算函数：根据缓存的频率数据算单个文件的推荐分数。"""
    fa = max((author_freq.get(a, 0) for a in authors), default=0)
    author_score = math.log1p(fa)

    tag_score = 0.0
    for tag in tags:
        ft = tag_freq.get(tag, 0)
        nt = max(tag_total.get(tag, 0), 1)
        current = math.log1p(ft) * (1.0 / math.sqrt(nt))
        if current > tag_score:
            tag_score = current

    return round(author_score + tag_score, 6)


def refresh_rec_cache(repo: IndexRepository) -> None:
    """从 DB 刷新内存中的 favorite 频率缓存。"""
    favorite_dir = (settings.FAVORITE_DIR or "").strip()
    if not favorite_dir:
        return

    favorite_prefix = str(Path(favorite_dir).resolve())
    try:
        author_freq = repo.get_favorite_author_frequencies(favorite_prefix)
        tag_freq = repo.get_favorite_tag_frequencies(favorite_prefix)
        tag_total = repo.get_tag_total_counts()
    except Exception as e:
        logger.warning("Failed to refresh rec cache: %s", e)
        return

    with _rec_cache_lock:
        _rec_cache["author_freq"] = author_freq
        _rec_cache["tag_freq"] = tag_freq
        _rec_cache["tag_total"] = tag_total
        _rec_cache["initialized"] = True

    logger.info("Rec cache refreshed: %d authors, %d tags", len(author_freq), len(tag_freq))


def update_rec_scores_for_files(repo: IndexRepository, filepaths: list[str]) -> None:
    """用内存缓存给指定文件计算并写入 rec_score。"""
    if not filepaths:
        return

    with _rec_cache_lock:
        if not _rec_cache["initialized"]:
            return
        author_freq = _rec_cache["author_freq"]
        tag_freq = _rec_cache["tag_freq"]
        tag_total = _rec_cache["tag_total"]

    artists_by_file = repo.get_artists_by_filepaths(filepaths)
    tags_by_file = repo.get_tags_by_filepaths(filepaths)

    scores: dict[str, float] = {}
    for fp in filepaths:
        scores[fp] = compute_rec_score_for_file(
            artists_by_file.get(fp, []),
            tags_by_file.get(fp, []),
            author_freq,
            tag_freq,
            tag_total,
        )

    repo.batch_update_rec_scores(scores)


def refresh_all_rec_scores(repo: IndexRepository) -> None:
    """全量重算所有文件的 rec_score（favorite 目录变化后调用）。"""
    refresh_rec_cache(repo)

    with _rec_cache_lock:
        if not _rec_cache["initialized"]:
            return
        author_freq = _rec_cache["author_freq"]
        tag_freq = _rec_cache["tag_freq"]
        tag_total = _rec_cache["tag_total"]

    if not author_freq and not tag_freq:
        return

    from sqlmodel import select as sql_select
    from app.index_db.models import FileArtist as FA, FileTag as FT

    all_fps_with_meta: set[str] = set()
    for fp in repo.session.exec(sql_select(FA.filepath).distinct()):
        if fp:
            all_fps_with_meta.add(fp)
    for fp in repo.session.exec(sql_select(FT.filepath).distinct()):
        if fp:
            all_fps_with_meta.add(fp)

    if not all_fps_with_meta:
        return

    fp_list = list(all_fps_with_meta)
    batch_size = 500
    for i in range(0, len(fp_list), batch_size):
        batch = fp_list[i : i + batch_size]
        artists_by_file = repo.get_artists_by_filepaths(batch)
        tags_by_file = repo.get_tags_by_filepaths(batch)

        scores: dict[str, float] = {}
        for fp in batch:
            scores[fp] = compute_rec_score_for_file(
                artists_by_file.get(fp, []),
                tags_by_file.get(fp, []),
                author_freq,
                tag_freq,
                tag_total,
            )
        repo.batch_update_rec_scores(scores)

    logger.info("All rec_scores refreshed for %d files", len(fp_list))
