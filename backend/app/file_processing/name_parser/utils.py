"""Utility functions for the name parser, ported from ParserUtil.js."""

from __future__ import annotations

import math
import re


def edit_distance(s: str, t: str) -> int:
    """Compute the Levenshtein edit distance between two strings."""
    if s == t:
        return 0
    n, m = len(s), len(t)
    if n == 0 or m == 0:
        return n + m

    prev = list(range(1, n + 1))

    for j in range(m):
        tc = t[j]
        prev_diag = j
        curr = j + 1
        for i in range(n):
            cost = 0 if s[i] == tc else 1
            curr = min(prev[i] + 1, curr + 1, prev_diag + cost)
            prev_diag = prev[i]
            prev[i] = curr

    return prev[n - 1]


def is_highly_similar(s1: str | None, s2: str | None) -> bool:
    """Return True when two strings are highly similar (edit-distance ratio ≤ 0.2)."""
    if not s1 and not s2:
        return True
    if not s1 or not s2:
        return False

    # Compare internal digit sequences first
    digits1 = re.findall(r"\d+", s1)
    digits2 = re.findall(r"\d+", s2)
    if digits1 != digits2:
        return False

    distance = edit_distance(s1, s2)
    avg_len = (len(s1) + len(s2)) / 2
    ratio = distance / math.ceil(avg_len)
    return ratio <= 0.2


def match_all(pattern: re.Pattern[str], text: str) -> list[str]:
    """Return all group(1) matches for *pattern* in *text*."""
    return [m.group(1) for m in pattern.finditer(text) if m.group(1)]
