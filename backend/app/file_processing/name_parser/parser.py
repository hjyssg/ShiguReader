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
    group: str | None = None
    raw_tags: list[str] = field(default_factory=list)
    event: str | None = None
    date_tag: str | None = None
    type: str = "UNKNOWN"


# ---------------------------------------------------------------------------
# Bracket regex helpers
# ---------------------------------------------------------------------------

_BRACKET_RE = re.compile(r"\[(.*?)\]")  # matches content inside []
_PAREN_RE = re.compile(r"\((.*?)\)")  # matches content inside ()

# Pattern: "group (name)" inside a single bracket token
_GROUP_AND_NAME_RE = re.compile(r"^(.*?)\s*\((.*?)\)$")


def _get_group_and_name(token: str) -> tuple[str | None, str]:
    """Split ``group (name)`` into (group, name). Returns (None, token) when no match."""
    m = _GROUP_AND_NAME_RE.match(token)
    if m:
        return m.group(1).strip() or None, m.group(2).strip()
    return None, token.strip()


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
    
    # Remove file extension
    if "." in title:
        title = title.rsplit(".", 1)[0]
    title = title.strip()

    result = ParseResult(
        title=title,
        authors=authors,
        group=group,
        raw_tags=raw_tags,
        event=event,
        date_tag=date_tag,
        type=media_type,
    )
    _cache[text] = result
    return result


def clear_cache() -> None:
    """Clear the internal parse cache."""
    _cache.clear()
