"""Name parser – extracts metadata from doujin / manga filenames.

Ported from the original ShiguReader JS ``packages/name-parser/index.js``.
"""

from __future__ import annotations

import json
import logging
import re
from urllib import error as urlerror
from urllib import request as urlrequest
from dataclasses import dataclass, field
from datetime import date, datetime

from app.core.config import settings
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

logger = logging.getLogger(__name__)

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

    这是一个可扩展框架入口：未来可替换为 SLM 分类。
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

    当前以规则为主，预留后续 SLM 增强入口。
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


def _extract_json_from_text(raw: str) -> dict | None:
    raw = raw.strip()
    if not raw:
        return None

    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    # 容错：从回答中截取第一个 JSON 对象
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        snippet = raw[start : end + 1]
        try:
            parsed = json.loads(snippet)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def _normalize_str_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if isinstance(item, str):
            s = item.strip()
            if s:
                out.append(s)
    return list(dict.fromkeys(out))


def _parse_with_slm_fallback(text: str) -> ParseResult | None:
    """SLM fallback parser.

    仅在规则解析失败后调用；调用失败时吞掉错误并返回 None。
    """
    if not settings.SLM_FALLBACK_ENABLED:
        return None

    base_url = (settings.SLM_BASE_URL or "").strip().rstrip("/")
    if not base_url:
        return None

    url = f"{base_url}/v1/chat/completions"

    def _discover_model_name() -> str | None:
        models_url = f"{base_url}/v1/models"
        try:
            with urlrequest.urlopen(models_url, timeout=settings.SLM_TIMEOUT_SEC) as resp:
                body = resp.read().decode("utf-8", errors="ignore")
            data = json.loads(body)
            models = data.get("data") if isinstance(data, dict) else None
            if isinstance(models, list):
                for item in models:
                    if isinstance(item, dict):
                        model_id = item.get("id")
                        if isinstance(model_id, str) and model_id.strip():
                            return model_id.strip()
        except Exception as exc:
            logger.warning("SLM model discovery failed: %s", exc)
        return None

    configured_model = (settings.SLM_MODEL or "").strip()
    model_name = configured_model
    if not model_name or model_name == "local-model":
        model_name = _discover_model_name() or model_name

    system_prompt = (
        "You are a filename metadata parser. "
        "Return JSON only with keys: title, authors, cosers, group, raw_tags, "
        "event, date_tag, type, pack_kind. "
        "authors/cosers/raw_tags must be string arrays. "
        "pack_kind must be manga or cosplay. "
        "If unsure, keep arrays empty and nullable fields null."
    )
    user_prompt = f"filename: {text}"

    body: str | None = None
    # 首次带 response_format；400 时自动降级重试（部分本地 SLM API 不支持）
    for with_response_format in (True, False):
        payload = {
            "temperature": 0.1,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        if model_name:
            payload["model"] = model_name
        if with_response_format:
            payload["response_format"] = {"type": "json_object"}

        req = urlrequest.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urlrequest.urlopen(req, timeout=settings.SLM_TIMEOUT_SEC) as resp:
                body = resp.read().decode("utf-8", errors="ignore")
            break
        except urlerror.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            # 若 model 可能无效，尝试自动发现并仅重试一次
            if exc.code == 400 and model_name and model_name == configured_model:
                discovered = _discover_model_name()
                if discovered and discovered != model_name:
                    model_name = discovered
                    continue
            if exc.code == 400 and with_response_format:
                continue
            logger.warning(
                "SLM fallback request failed for %s: HTTP %s %s",
                text,
                exc.code,
                detail[:240],
            )
            return None
        except (urlerror.URLError, TimeoutError, OSError) as exc:
            logger.warning("SLM fallback request failed for %s: %s", text, exc)
            return None

    if not body:
        return None

    try:
        response_json = json.loads(body)
    except json.JSONDecodeError:
        logger.warning("SLM fallback returned invalid JSON envelope: %s", body[:240])
        return None

    content = (
        response_json.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    parsed = _extract_json_from_text(content if isinstance(content, str) else "")
    if not parsed:
        return None

    title = parsed.get("title")
    title = title.strip() if isinstance(title, str) and title.strip() else _strip_filename_ext(text)
    authors = _normalize_str_list(parsed.get("authors"))
    cosers = _normalize_str_list(parsed.get("cosers"))
    raw_tags = _normalize_str_list(parsed.get("raw_tags"))

    group = parsed.get("group")
    group = group.strip() if isinstance(group, str) and group.strip() else None
    event = parsed.get("event")
    event = event.strip() if isinstance(event, str) and event.strip() else None
    date_tag = parsed.get("date_tag")
    date_tag = date_tag.strip() if isinstance(date_tag, str) and date_tag.strip() else None
    media_type = parsed.get("type")
    media_type = media_type.strip() if isinstance(media_type, str) and media_type.strip() else "UNKNOWN"
    pack_kind = parsed.get("pack_kind")
    if pack_kind not in {"manga", "cosplay"}:
        pack_kind = "cosplay" if cosers else "manga"

    if not authors and not cosers and not raw_tags and not group and not event and not date_tag:
        return None

    return ParseResult(
        title=title,
        authors=authors,
        cosers=cosers,
        group=group,
        raw_tags=raw_tags,
        event=event,
        date_tag=date_tag,
        type=media_type,
        pack_kind=pack_kind,
    )


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
        fallback_result = _parse_with_slm_fallback(text)
        _cache[text] = fallback_result
        return fallback_result

    # Cosplay strategy: 与传统漫画 parser 分流
    if _is_cosplay_pack(text, b_matches):
        cosplay_result = _parse_cosplay(text, b_matches, p_matches)
        if cosplay_result is not None:
            _cache[text] = cosplay_result
            return cosplay_result

        fallback_result = _parse_with_slm_fallback(text)
        _cache[text] = fallback_result
        return fallback_result

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
        fallback_result = _parse_with_slm_fallback(text)
        _cache[text] = fallback_result
        return fallback_result

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
