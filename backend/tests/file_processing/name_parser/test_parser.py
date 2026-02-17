"""Tests for the name parser module."""

from __future__ import annotations

import pytest

from app.file_processing.name_parser.parser import ParseResult, clear_cache, parse


@pytest.fixture(autouse=True)
def _clear_parser_cache():
    """Ensure each test starts with a clean cache."""
    clear_cache()
    yield
    clear_cache()


# ---------------------------------------------------------------------------
# Basic parsing
# ---------------------------------------------------------------------------


class TestBasicParsing:
    def test_returns_none_for_empty_string(self):
        assert parse("") is None

    def test_returns_none_for_no_brackets(self):
        assert parse("just a plain filename.zip") is None

    def test_returns_none_when_only_useless_tags(self):
        assert parse("[DL版].zip") is None

    def test_simple_author_and_title(self):
        r = parse("[作者名] タイトル.zip")
        assert r is not None
        assert r.authors == ["作者名"]
        assert "タイトル" in r.title

    def test_result_is_dataclass(self):
        r = parse("[Author] Title (Tag1).zip")
        assert r is not None
        assert isinstance(r, ParseResult)


# ---------------------------------------------------------------------------
# Author extraction
# ---------------------------------------------------------------------------


class TestAuthorExtraction:
    def test_single_author(self):
        r = parse("[武田弘光] 作品名 (東方Project).zip")
        assert r is not None
        assert r.authors == ["武田弘光"]

    def test_group_and_author(self):
        r = parse("[真珠貝(武田弘光)] 作品名.zip")
        assert r is not None
        assert r.authors == ["武田弘光"]
        assert r.group == "真珠貝"

    def test_multiple_authors_comma(self):
        r = parse("[作者A、作者B] 作品名.zip")
        assert r is not None
        assert set(r.authors) == {"作者A", "作者B"}

    def test_multiple_authors_ampersand(self):
        r = parse("[AuthorA&AuthorB] Title.zip")
        assert r is not None
        assert set(r.authors) == {"AuthorA", "AuthorB"}

    def test_not_author_tag_skipped(self):
        """Tags like 'よろず' or 'Pixiv' should not be treated as author."""
        r = parse("[よろず] 作品名 (タグ1).zip")
        assert r is not None
        assert "よろず" not in r.authors
        assert "よろず" in r.raw_tags

    def test_dl_version_not_author(self):
        r = parse("[作者名] 作品名 [DL版].zip")
        assert r is not None
        assert r.authors == ["作者名"]
        assert "DL版" not in r.raw_tags  # filtered as useless


# ---------------------------------------------------------------------------
# Event detection
# ---------------------------------------------------------------------------


class TestEventDetection:
    def test_comiket_c101(self):
        r = parse("[C101] [作者] 作品名.zip")
        assert r is not None
        assert r.event == "C101"

    def test_comiket_c99(self):
        r = parse("[C99] [作者] 作品名.zip")
        assert r is not None
        assert r.event == "C99"

    def test_comic1_star(self):
        r = parse("[COMIC1☆15] [作者] 作品名.zip")
        assert r is not None
        assert r.event == "COMIC1☆15"

    def test_reitaisai(self):
        r = parse("[例大祭19] [作者] 作品名.zip")
        assert r is not None
        assert r.event == "例大祭19"


# ---------------------------------------------------------------------------
# Date tag detection
# ---------------------------------------------------------------------------


class TestDateTag:
    def test_yyyymmdd(self):
        r = parse("[20220312] [作者] 作品名.zip")
        assert r is not None
        assert r.date_tag == "20220312"

    def test_yymmdd(self):
        r = parse("[220312] [作者] 作品名.zip")
        assert r is not None
        assert r.date_tag == "220312"

    def test_yyyy_mm_dd_dash(self):
        r = parse("[2022-03-12] [作者] 作品名.zip")
        assert r is not None
        assert r.date_tag == "2022-03-12"

    def test_japanese_date(self):
        r = parse("[2022年3月12日] [作者] 作品名.zip")
        assert r is not None
        assert r.date_tag == "2022年3月12日"


# ---------------------------------------------------------------------------
# Media type detection
# ---------------------------------------------------------------------------


class TestMediaType:
    def test_doujinshi_explicit(self):
        r = parse("[同人誌] [作者] 作品名.zip")
        assert r is not None
        # 同人誌 is filtered as useless tag but sets media_type
        assert r.type == "同人誌"

    def test_doujin_cg(self):
        r = parse("[同人CG集] [作者] 作品名.zip")
        assert r is not None
        assert r.type == "同人CG集"

    def test_inferred_doujinshi_from_event(self):
        r = parse("[C101] [作者] 作品名.zip")
        assert r is not None
        assert r.type == "同人誌"

    def test_inferred_doujinshi_from_group(self):
        r = parse("[サークル(作者)] 作品名.zip")
        assert r is not None
        assert r.type == "同人誌"

    def test_unknown_type(self):
        r = parse("[作者] 作品名 (タグ).zip")
        assert r is not None
        assert r.type == "UNKNOWN"


# ---------------------------------------------------------------------------
# Tag extraction
# ---------------------------------------------------------------------------


class TestTagExtraction:
    def test_paren_tags(self):
        r = parse("[作者] 作品名 (東方Project).zip")
        assert r is not None
        assert "東方Project" in r.raw_tags

    def test_multiple_bracket_tags(self):
        r = parse("[作者] 作品名 [タグ1] [タグ2].zip")
        assert r is not None
        # タグ1 and タグ2 should be in raw_tags (they come after author)
        assert "タグ1" in r.raw_tags

    def test_tag_separator_split(self):
        r = parse("[作者] 作品名 (タグA、タグB).zip")
        assert r is not None
        assert "タグA" in r.raw_tags
        assert "タグB" in r.raw_tags

    def test_useless_tags_filtered(self):
        r = parse("[作者] 作品名 (修正版).zip")
        assert r is not None
        assert "修正版" not in r.raw_tags

    def test_numeric_tags_filtered(self):
        r = parse("[作者] 作品名 (131715678).zip")
        assert r is not None
        assert "131715678" not in r.raw_tags

    def test_non_pure_numeric_tags_kept(self):
        r = parse("[作者] 作品名 (C101).zip")
        assert r is not None
        assert "C101" in r.raw_tags or r.event == "C101"


# ---------------------------------------------------------------------------
# Title extraction
# ---------------------------------------------------------------------------


class TestTitleExtraction:
    def test_title_extracted(self):
        r = parse("[作者] 素敵な作品名.zip")
        assert r is not None
        assert "素敵な作品名" in r.title

    def test_title_strips_extension(self):
        r = parse("[作者] 作品名.zip")
        assert r is not None
        assert ".zip" not in r.title

    def test_title_strips_brackets(self):
        r = parse("[作者] 作品名 (タグ).zip")
        assert r is not None
        assert "[" not in r.title
        assert "]" not in r.title
        assert "(" not in r.title
        assert ")" not in r.title


# ---------------------------------------------------------------------------
# Caching
# ---------------------------------------------------------------------------


class TestCaching:
    def test_same_input_returns_same_object(self):
        r1 = parse("[作者] 作品名.zip")
        r2 = parse("[作者] 作品名.zip")
        assert r1 is r2

    def test_none_result_cached(self):
        r1 = parse("no brackets")
        r2 = parse("no brackets")
        assert r1 is None
        assert r2 is None

    def test_clear_cache_works(self):
        r1 = parse("[作者] 作品名.zip")
        clear_cache()
        r2 = parse("[作者] 作品名.zip")
        assert r1 is not r2
        assert r1.authors == r2.authors


# ---------------------------------------------------------------------------
# Complex real-world filenames
# ---------------------------------------------------------------------------


class TestRealWorldFilenames:
    def test_full_doujin_filename(self):
        name = "[C101] [真珠貝(武田弘光)] 作品タイトル (艦これ) [DL版].zip"
        r = parse(name)
        assert r is not None
        assert r.event == "C101"
        assert r.authors == ["武田弘光"]
        assert r.group == "真珠貝"
        assert "艦これ" in r.raw_tags

    def test_dated_filename(self):
        name = "[20220815] [サークル(作者A、作者B)] 長いタイトル名 (東方Project).zip"
        r = parse(name)
        assert r is not None
        assert r.date_tag == "20220815"
        assert set(r.authors) == {"作者A", "作者B"}
        assert r.group == "サークル"
        assert "東方Project" in r.raw_tags

    def test_commercial_manga(self):
        name = "[成年コミック] [作者名] 漫画タイトル 第01巻.zip"
        r = parse(name)
        assert r is not None
        assert r.type == "成年コミック"
        assert r.authors == ["作者名"]


class TestCosplayCoserNormalization:
    def test_only_keep_cosers_in_db(self, monkeypatch: pytest.MonkeyPatch):
        from app.file_processing.name_parser import coser_db

        mapping = {
            "RealCoser": "RealCoser",
            "RC": "RealCoser",
        }
        monkeypatch.setattr(coser_db, "lookup_coser", lambda name: mapping.get(name))

        r = parse("[Cosplay] [RealCoser] [武田弘光] Set.zip")
        assert r is not None
        assert r.cosers == ["RealCoser"]

    def test_no_db_match_results_in_no_coser(self, monkeypatch: pytest.MonkeyPatch):
        from app.file_processing.name_parser import coser_db

        monkeypatch.setattr(coser_db, "lookup_coser", lambda _name: None)

        r = parse("[Cosplay] [武田弘光] Set.zip")
        assert r is None or r.cosers == []
