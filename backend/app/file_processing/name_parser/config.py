"""Configuration data for the name parser, ported from the original JS version."""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Strings that look like authors but are actually tags / noise
# ---------------------------------------------------------------------------
NOT_AUTHOR_BUT_TAG: list[str] = [
    "同人音声",
    "同人誌",
    "アンソロジー",
    "DL版",
    "よろず",
    "成年コミック",
    "Pixiv",
    "アーティスト",
    "雑誌",
    "English",
    "Chinese",
    "320K",
]

_not_author_but_tag_pattern = re.compile(
    "|".join(re.escape(t) + "$" for t in NOT_AUTHOR_BUT_TAG),
    re.IGNORECASE,
)


def is_not_author(text: str) -> bool:
    return _not_author_but_tag_pattern.search(text.lower()) is not None


# ---------------------------------------------------------------------------
# Useless tags that should be discarded
# ---------------------------------------------------------------------------
_useless_tag_pattern = re.compile(
    r"DL版|同人誌|別スキャン|修正版|^エロ|^digital$|^JPG|^PNG|ページ補足|進行中|別版|Various",
    re.IGNORECASE,
)


def is_useless_tag(text: str) -> bool:
    return _useless_tag_pattern.search(text) is not None


# ---------------------------------------------------------------------------
# Media types
# ---------------------------------------------------------------------------
MEDIA_TYPES: list[str] = [
    "同人音声",
    "同人催眠音声",
    "同人ソフト",
    "同人CG集",
    "同人CG",
    "同人ゲーム",
    "同人GAME",
    "成年コミック",
    "一般コミック",
    "一般漫画",
    "ゲームCG",
    "イラスト集",
    "アンソロジー",
    "画集",
    "雑誌",
    "18禁ゲーム",
    "GAME",
    "CG",
    "同人誌",
    "DOUJINSHI",
]

_media_type_pattern = re.compile(
    "|".join(f"({re.escape(t)})" for t in MEDIA_TYPES),
    re.IGNORECASE,
)


def is_media_type(text: str) -> bool:
    return _media_type_pattern.search(text) is not None


def get_media_type(text: str) -> str | None:
    m = _media_type_pattern.search(text)
    return m.group(0) if m else None


# ---------------------------------------------------------------------------
# Doujin events (conventions)
# ---------------------------------------------------------------------------
_event_patterns: list[re.Pattern[str]] = [
    re.compile(r"C1\d{2}", re.IGNORECASE),
    re.compile(r"^C\d{2}$", re.IGNORECASE),
    re.compile(r"^エアコミケ\d{1}$", re.IGNORECASE),
    re.compile(r"^COMIC1☆\d{1,2}$", re.IGNORECASE),
    re.compile(r"^僕らのラブライブ!", re.IGNORECASE),
    re.compile(r"^コミティア.*\d"),
    re.compile(r"^サンクリ.*\d+"),
    re.compile(r"^例大祭.*\d+"),
    re.compile(r"^とら祭り.*\d+"),
    re.compile(r"^こみトレ.*\d+"),
    re.compile(r"みみけっと.*\d+"),
    re.compile(r"コミトレ.*\d+"),
    re.compile(r"FF\d+"),
    re.compile(r"iDOL SURVIVAL.*\d", re.IGNORECASE),
    re.compile(r"SC\d+"),
    re.compile(r"コミコミ.*\d"),
    re.compile(r"ふたけっと.*\d"),
    re.compile(r"ファータグランデ騎空祭"),
    re.compile(r"歌姫庭園"),
    re.compile(r"紅楼夢"),
    re.compile(r"CSP\d"),
    re.compile(r"CC大阪\d"),
    re.compile(r"COMITIA\d"),
]

_event_combined = re.compile(
    "|".join(p.pattern for p in _event_patterns),
    re.IGNORECASE,
)


def belongs_to_event(text: str) -> bool:
    return _event_combined.search(text) is not None


# ---------------------------------------------------------------------------
# Date patterns
# ---------------------------------------------------------------------------
_date_regexes = [
    re.compile(r"(\d{4})(\d{1,2})(\d{2})"),
    re.compile(r"(\d{2})(\d{2})(\d{2})"),
    re.compile(r"(\d{2})-(\d{2})-(\d{2})"),
    re.compile(r"(\d{4})-(\d{1,2})-(\d{2})"),
    re.compile(r"(\d{4})年(\d{1,2})月号"),
    re.compile(r"(\d{4})年(\d{1,2})月(\d{1,2})日"),
    re.compile(r"(\d{4})\.(\d{1,2})\.(\d{1,2})"),
]

DATE_PATTERN = re.compile(
    "|".join(r.pattern for r in _date_regexes),
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Author separator (comma, 、, &, ＆)
# ---------------------------------------------------------------------------
AUTHOR_SEPARATOR = re.compile(r"[,、&＆]")

# Tag separator (comma, 、)
TAG_SEPARATOR = re.compile(r"[,、]")
