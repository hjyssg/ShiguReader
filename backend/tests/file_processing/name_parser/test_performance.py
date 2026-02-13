"""Performance tests for the name parser."""

from __future__ import annotations

import random
import string

import pytest

from app.file_processing.name_parser.parser import clear_cache, parse


def random_suffix(length: int = 8) -> str:
    """Generate a random string suffix to avoid cache hits."""
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=length))


# Sample filenames representing different complexity levels
SAMPLE_FILENAMES = [
    "[作者名] タイトル_{suffix}.zip",
    "[C101] [真珠貝(武田弘光)] 作品タイトル (艦これ) [DL版]_{suffix}.zip",
    "[20220815] [サークル(作者A、作者B)] 長いタイトル名 (東方Project)_{suffix}.zip",
    "[成年コミック] [作者名] 漫画タイトル 第01巻_{suffix}.zip",
    "[同人CG集] [グループ名(作者1&作者2)] CG作品 (オリジナル) [高解像度]_{suffix}.zip",
    "[例大祭19] [サークル] 東方作品 (東方Project) [DL版]_{suffix}.zip",
    "[COMIC1☆15] [作者] 作品名 (タグ1、タグ2、タグ3)_{suffix}.zip",
    "[2022-03-12] [作者] 作品_{suffix}.zip",
    "plain_filename_no_brackets_{suffix}.zip",
    "[よろず] 作品名 (タグ1)_{suffix}.zip",
]


@pytest.fixture(autouse=True)
def _clear_parser_cache():
    """Ensure each test starts with a clean cache."""
    clear_cache()
    yield
    clear_cache()


def test_parse_performance_20k_iterations(benchmark: pytest.BenchmarkFixture):
    """Benchmark parsing 20,000 unique filenames (no cache hits)."""

    def parse_batch():
        results = []
        for _ in range(2000):  # 2000 iterations × 10 samples = 20,000 parses
            for template in SAMPLE_FILENAMES:
                filename = template.format(suffix=random_suffix())
                result = parse(filename)
                results.append(result)
        return results

    results = benchmark(parse_batch)
    assert len(results) == 20000


def test_parse_performance_mixed_cache(benchmark: pytest.BenchmarkFixture):
    """Benchmark with 50% cache hits (10k unique + 10k repeated)."""

    # Pre-generate 10k unique filenames
    unique_filenames = []
    for _ in range(1000):
        for template in SAMPLE_FILENAMES:
            unique_filenames.append(template.format(suffix=random_suffix()))

    def parse_mixed():
        results = []
        # Parse unique filenames (cache miss)
        for filename in unique_filenames:
            results.append(parse(filename))
        # Parse same filenames again (cache hit)
        for filename in unique_filenames:
            results.append(parse(filename))
        return results

    results = benchmark(parse_mixed)
    assert len(results) == 20000


def test_parse_simple_filename(benchmark: pytest.BenchmarkFixture):
    """Benchmark simple filename parsing."""

    def parse_simple():
        return parse(f"[作者名] タイトル_{random_suffix()}.zip")

    result = benchmark(parse_simple)
    assert result is not None


def test_parse_complex_filename(benchmark: pytest.BenchmarkFixture):
    """Benchmark complex filename parsing."""

    def parse_complex():
        return parse(
            f"[C101] [真珠貝(武田弘光)] 作品タイトル (艦これ、タグ2、タグ3) [DL版]_{random_suffix()}.zip"
        )

    result = benchmark(parse_complex)
    assert result is not None


def test_parse_no_brackets(benchmark: pytest.BenchmarkFixture):
    """Benchmark filename with no brackets (early exit)."""

    def parse_no_brackets():
        return parse(f"plain_filename_{random_suffix()}.zip")

    result = benchmark(parse_no_brackets)
    assert result is None
