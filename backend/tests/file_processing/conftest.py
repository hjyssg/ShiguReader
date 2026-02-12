from __future__ import annotations

from pathlib import Path

import pytest

from tests.file_processing.utils.test_data_generator import TestDataGenerator


@pytest.fixture(scope="session")
def file_processing_data_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    return tmp_path_factory.mktemp("file_processing_data")


@pytest.fixture(scope="session")
def file_processing_data(file_processing_data_dir: Path) -> dict[str, object]:
    return TestDataGenerator(file_processing_data_dir).prepare_all()
