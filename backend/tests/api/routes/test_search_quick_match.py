from __future__ import annotations

from contextlib import contextmanager
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api.routes import search as search_route
from app.index_db.models import File, ParsedMetadata


def _make_file(filepath: str, filename: str) -> File:
    return File(
        filepath=filepath,
        filename=filename,
        mtime=1,
        filesize=1,
        fingerprint=f"fp-{filepath}",
    )


def _build_fake_repo(candidates: list[File], artists: dict[str, list[str]], parsed: dict[str, ParsedMetadata]):
    class FakeRepo:
        def __init__(self, _session) -> None:
            pass

        def search_files(self, _q: str, mode: str = "hybrid", presence_filter: str = "all") -> list[File]:
            return candidates

        def search_by_author(self, _q: str, mode: str = "hybrid", presence_filter: str = "all") -> list[File]:
            return candidates

        def get_artists_by_filepaths(self, _filepaths: list[str]) -> dict[str, list[str]]:
            return artists

        def get_parsed_metadata_by_filepaths(self, _filepaths: list[str]) -> dict[str, ParsedMetadata]:
            return parsed

    return FakeRepo


@contextmanager
def _fake_index_session():
    yield SimpleNamespace()


@pytest.mark.parametrize(
    ("query", "candidate_title", "candidate_author", "expected_level"),
    [
        ("[Alice] My Book Vol 1", "My Book Vol 1", "Alice", "downloaded"),
        ("My Book Vol 1", "My Book Vol 1", "", "likely"),
        ("[Alice] My Book Vol 1", "My Book Vol 2", "Alice", "same_author"),
    ],
)
def test_quick_match_batch_core_levels(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    query: str,
    candidate_title: str,
    candidate_author: str,
    expected_level: str,
) -> None:
    file = _make_file("/tmp/book.cbz", "book.cbz")
    artists = {file.filepath: [candidate_author]} if candidate_author else {file.filepath: []}
    parsed = {
        file.filepath: ParsedMetadata(
            filepath=file.filepath,
            title=candidate_title,
            group_name=None,
            event=None,
            date_tag=None,
            media_type="同人誌",
        )
    }

    monkeypatch.setattr(search_route, "get_index_session", _fake_index_session)
    monkeypatch.setattr(
        search_route,
        "IndexRepository",
        _build_fake_repo([file], artists, parsed),
    )

    response = client.post(
        "/api/v1/search/quick-match-batch",
        json={
            "queries": [query],
            "limit": 5,
            "chunk_size": 20,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["results"]
    result = payload["results"][0]
    assert result["match_level"] == expected_level


def test_quick_match_batch_preserves_query_order(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = _make_file("/tmp/book.cbz", "book.cbz")
    parsed = {
        file.filepath: ParsedMetadata(
            filepath=file.filepath,
            title="A Title",
            group_name=None,
            event=None,
            date_tag=None,
            media_type="同人誌",
        )
    }

    monkeypatch.setattr(search_route, "get_index_session", _fake_index_session)
    monkeypatch.setattr(
        search_route,
        "IndexRepository",
        _build_fake_repo([file], {file.filepath: []}, parsed),
    )

    queries = ["Q1", "Q2", "Q3"]
    response = client.post(
        "/api/v1/search/quick-match-batch",
        json={"queries": queries, "chunk_size": 2},
    )

    assert response.status_code == 200
    payload = response.json()
    assert [r["q"] for r in payload["results"]] == queries
