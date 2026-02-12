from __future__ import annotations

import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from app.file_processing._archive_backend import extract_entries, list_entries, replace_dir_atomic


@dataclass(slots=True)
class StepwiseExtractResult:
    first_stage_extracted: list[str]
    second_stage_extracted: list[str]
    output_dir: Path


def stepwise_extract(
    archive_path: str | Path,
    output_dir: str | Path,
    *,
    prioritized_entries: list[str] | None = None,
    prioritized_rule: Callable[[str], bool] | None = None,
    fail_after_prioritized: bool = False,
) -> StepwiseExtractResult:
    archive = Path(archive_path)
    out_dir = Path(output_dir)
    all_entries = list_entries(archive)

    explicit = set(prioritized_entries or [])
    first_stage: list[str] = []
    for entry in all_entries:
        if entry in explicit or (prioritized_rule(entry) if prioritized_rule else False):
            first_stage.append(entry)
    first_stage = list(dict.fromkeys(first_stage))
    second_stage = [entry for entry in all_entries if entry not in set(first_stage)]

    work_dir = Path(tempfile.mkdtemp(prefix="stepwise-"))
    try:
        extract_entries(archive, work_dir, first_stage)
        if fail_after_prioritized:
            raise RuntimeError("Simulated failure after prioritized extraction")
        extract_entries(archive, work_dir, second_stage)
        replace_dir_atomic(work_dir, out_dir)
    except Exception:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise

    return StepwiseExtractResult(
        first_stage_extracted=first_stage,
        second_stage_extracted=second_stage,
        output_dir=out_dir,
    )
