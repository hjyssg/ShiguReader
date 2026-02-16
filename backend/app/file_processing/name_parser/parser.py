"""Name parser – extracts metadata from doujin / manga filenames.

Ported from the original ShiguReader JS ``packages/name-parser/index.js``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime

from app.file_processing.name_parser.config import (
    AUTHOR_SEPARATOR,
    DATE_PATTERN,
    TAG_SEPARATOR,
    belongs_to_event,
    get_media_type,
    is_media_type,
    is_not_author,
    is_useless_tag,
)
from app.file_processing.name_parser.utils import match_all

# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class ParseResult:
    title: str = ""
    authors: list[str] = field(default_factory=list)
    cosers: list[str] = field(default_factory=list)
    group: str | None = None
    raw_tags: list[str] = field(default_factory=list)
    event: str | None = None
    date_tag: str | None = None
    type: str = "UNKNOWN"
    pack_kind: str = "manga"


# ---------------------------------------------------------------------------
# Bracket regex helpers
# ---------------------------------------------------------------------------

_BRACKET_RE = re.compile(r"\[(.*?)\]")  # matches content inside []
_PAREN_RE = re.compile(r"\((.*?)\)")  # matches content inside ()

# Pattern: "group (name)" inside a single bracket token
_GROUP_AND_NAME_RE = re.compile(r"^(.*?)\s*\((.*?)\)$")
_COSPLAY_HINT_RE = re.compile(r"cosplay|コスプレ|cosrom|coser", re.IGNORECASE)


def _get_group_and_name(token: str) -> tuple[str | None, str]:
    """Split ``group (name)`` into (group, name). Returns (None, token) when no match."""
    m = _GROUP_AND_NAME_RE.match(token)
    if m:
        return m.group(1).strip() or None, m.group(2).strip()
    return None, token.strip()


def _is_cosplay_pack(text: str, bracket_tokens: list[str]) -> bool:
    """Best-effort cosplay pack detection.
    """
    if _COSPLAY_HINT_RE.search(text):
        return True

    for token in bracket_tokens:
        t = token.strip()
        if not t:
            continue
        if _COSPLAY_HINT_RE.search(t):
            return True
        # CHxx / Cosrom 常见于 cosplay 发布
        if re.match(r"^CH\d{1,3}$", t, re.IGNORECASE):
            return True

    return False


def _normalize_person_name(token: str) -> str:
    name = token.strip()
    name = re.sub(r"^@+", "", name)
    name = re.sub(r"^coser\s*[@：:]?\s*", "", name, flags=re.IGNORECASE)
    name = re.sub(r"^cosplayer\s*[@：:]?\s*", "", name, flags=re.IGNORECASE)
    return name.strip(" -_")


def _parse_cosplay(text: str, b_matches: list[str], p_matches: list[str]) -> ParseResult | None:
    """Cosplay filename parser.
    """
    cosers: list[str] = []
    tags: list[str] = []
    date_tag: str | None = None
    event: str | None = None

    def _classify_misc(token: str) -> bool:
        nonlocal date_tag, event
        if not token:
            return True
        if _COSPLAY_HINT_RE.search(token):
            return True
        if belongs_to_event(token):
            event = token
            return True
        if _is_str_date(token):
            date_tag = token
            return True
        if is_media_type(token) or is_useless_tag(token):
            return True
        return False

    # 1) 先用 [] 提取人名候选
    for raw in b_matches:
        token = raw.strip()
        if not token or _classify_misc(token):
            continue
        norm = _normalize_person_name(token)
        if norm and not is_not_author(norm.lower()):
            cosers.append(norm)
        else:
            tags.append(token)

    # 2) 处理 "(Cosplay) Name - Character" 的前缀 name
    # 去掉开头的括号块，取第一个连字符前的段
    head = _BRACKET_RE.sub("", text)
    head = _PAREN_RE.sub("", head)
    if " - " in head:
        left, right = head.split(" - ", 1)
        left_name = _normalize_person_name(left)
        if left_name and not _classify_misc(left_name) and not is_not_author(left_name.lower()):
            cosers.append(left_name)
        # 角色名作为 tag 候选
        right_tag = right.rsplit(".", 1)[0].strip()
        if right_tag and not _classify_misc(right_tag):
            tags.append(right_tag)

    # 3) () 内容一般作为作品/角色标签
    tags.extend([t.strip() for t in p_matches if t.strip()])

    # 清洗 tag
    split_tags: list[str] = []
    for t in tags:
        split_tags.extend(TAG_SEPARATOR.split(t))
    raw_tags = [t.strip() for t in split_tags if t.strip()]
    coser_set = {c for c in cosers if c}
    raw_tags = [
        t
        for t in raw_tags
        if len(t) > 1
        and t not in coser_set
        and not _classify_misc(t)
        and not is_useless_tag(t)
    ]

    # 去重保序
    cosers = list(dict.fromkeys(cosers))
    raw_tags = list(dict.fromkeys(raw_tags))

    # 标准化 coser 名字（使用数据库查找）
    # 直接从原始文本中用 Aho-Corasick 查找，避免循环
    try:
        from app.file_processing.name_parser.coser_db import find_cosers_in_text
        # 从原始文本中查找所有匹配的coser（比循环快得多）
        db_cosers = find_cosers_in_text(text)
        if db_cosers:
            # 如果数据库找到了coser，使用数据库结果
            cosers = db_cosers
    except Exception:
        # 如果数据库不存在或出错，保持原解析结果
        pass

    title = _BRACKET_RE.sub("", text)
    title = _PAREN_RE.sub("", title)
    if "." in title:
        title = title.rsplit(".", 1)[0]
    title = title.strip()

    if not cosers and not raw_tags:
        return None

    return ParseResult(
        title=title,
        authors=[],
        cosers=cosers,
        group=None,
        raw_tags=raw_tags,
        event=event,
        date_tag=date_tag,
        type="COSPLAY",
        pack_kind="cosplay",
    )


def _strip_filename_ext(text: str) -> str:
    value = text.strip()
    if "." in value:
        value = value.rsplit(".", 1)[0]
    return value.strip()


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

_CURRENT_YEAR = datetime.now().year


def _convert_year(y_str: str) -> int:
    y = int(y_str)
    if len(y_str) == 2:
        y = 1900 + y if y > 70 else 2000 + y
    return y


def _is_str_date(text: str) -> bool:
    """Return True if *text* looks like a date string."""
    m = DATE_PATTERN.search(text)
    if not m:
        return False
    # Extract the first three non-None groups as y, m, d
    groups = [g for g in m.groups() if g is not None]
    if len(groups) < 2:
        return False
    try:
        y = _convert_year(groups[0])
        month = int(groups[1])
        day = int(groups[2]) if len(groups) >= 3 else 1
    except (ValueError, IndexError):
        return False
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return False
    if y > _CURRENT_YEAR + 2 or y < 1970:
        return False
    try:
        date(y, month, day)
    except ValueError:
        return False
    return True


# ---------------------------------------------------------------------------
# Main parse function
# ---------------------------------------------------------------------------

# Cache to avoid re-parsing the same string
_cache: dict[str, ParseResult | None] = {}


def parse(text: str) -> ParseResult | None:
    """Parse a filename string and return a :class:`ParseResult`, or *None* if
    nothing useful can be extracted.

    The function mirrors the logic of the original JS ``parse()`` in
    ``packages/name-parser/index.js``.
    """
    if not text:
        return None

    cached = _cache.get(text)
    if cached is not None:
        return cached
    if text in _cache:  # explicitly cached as None
        return None

    b_matches = match_all(_BRACKET_RE, text)  # content inside []
    p_matches = match_all(_PAREN_RE, text)  # content inside ()

    if not b_matches and not p_matches:
        _cache[text] = None
        return None

    # Cosplay strategy: 与传统漫画 parser 分流
    if _is_cosplay_pack(text, b_matches):
        cosplay_result = _parse_cosplay(text, b_matches, p_matches)
        if cosplay_result is not None:
            _cache[text] = cosplay_result
            return cosplay_result

        _cache[text] = None
        return None

    authors: list[str] = []
    group: str | None = None
    date_tag: str | None = None
    event: str | None = None
    media_type: str | None = None
    tags: list[str] = []

    # ------------------------------------------------------------------
    # Helper: classify a token as event / date / media-type / useless
    # ------------------------------------------------------------------
    def _classify_other(token: str) -> bool:
        """Return True if *token* is a recognised non-author, non-tag token."""
        nonlocal media_type, event, date_tag
        if is_media_type(token):
            media_type = get_media_type(token)
            return True
        if belongs_to_event(token):
            event = token
            return True
        if _is_str_date(token):
            date_tag = token
            return True
        if is_useless_tag(token):
            return True
        return False

    # ------------------------------------------------------------------
    # Process [] tokens – first non-classified [] is the author
    # ------------------------------------------------------------------
    author_found = False
    for idx, raw_token in enumerate(b_matches):
        token = raw_token.strip()
        if not token:
            continue

        # Check position context: if the bracket is at the very end of the
        # string (before extension) or followed by a dot, treat as tag.
        next_char_idx = text.index(raw_token) + len(raw_token) + 1  # +1 for ']'
        next_char = text[next_char_idx] if next_char_idx < len(text) else None

        if _classify_other(token):
            continue

        if is_not_author(token.lower()):
            tags.append(token)
        elif next_char == "." or next_char_idx >= len(text):
            tags.append(token)
        elif not author_found:
            grp, name = _get_group_and_name(token)
            if name and not is_not_author(name):
                authors = [a.strip() for a in AUTHOR_SEPARATOR.split(name) if a.strip()]
                group = grp
                author_found = True
            else:
                tags.append(token)
        else:
            tags.append(token)

    # ------------------------------------------------------------------
    # Process () tokens – all go to tags
    # ------------------------------------------------------------------
    if p_matches:
        tags.extend(p_matches)

    # ------------------------------------------------------------------
    # Split tags by separator and clean up
    # ------------------------------------------------------------------
    split_tags: list[str] = []
    for t in tags:
        split_tags.extend(TAG_SEPARATOR.split(t))

    raw_tags = [t.strip() for t in split_tags if t.strip()]

    # Filter out noise
    author_set = set(authors)
    raw_tags = [
        t
        for t in raw_tags
        if len(t) > 1
        and not _classify_other(t)
        and t not in author_set
        and not is_useless_tag(t)
        and not is_media_type(t)
    ]

    # ------------------------------------------------------------------
    # Determine type
    # ------------------------------------------------------------------
    if not media_type:
        if event or group:
            media_type = "同人誌"
        else:
            media_type = "UNKNOWN"

    # ------------------------------------------------------------------
    # Early exit if nothing useful
    # ------------------------------------------------------------------
    if not authors and not group and not raw_tags:
        _cache[text] = None
        return None

    # ------------------------------------------------------------------
    # Extract title (everything outside brackets) - optimized
    # ------------------------------------------------------------------
    # Use regex to remove all bracket content in one pass
    title = _BRACKET_RE.sub("", text)
    title = _PAREN_RE.sub("", title)
    
    title = _strip_filename_ext(title)

    result = ParseResult(
        title=title,
        authors=authors,
        cosers=[],
        group=group,
        raw_tags=raw_tags,
        event=event,
        date_tag=date_tag,
        type=media_type,
        pack_kind="manga",
    )
    _cache[text] = result
    return result


def clear_cache() -> None:
    """Clear the internal parse cache."""
    _cache.clear()
