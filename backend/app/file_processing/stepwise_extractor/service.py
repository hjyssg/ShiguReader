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
    """
    Extract archive in two stages with progressive file availability.
    
    Stage 1 (prioritized): Files are extracted directly to output_dir and immediately available.
    Stage 2 (remaining): Files are extracted to temp dir then merged into output_dir.
    
    This ensures that prioritized files (e.g., current page ±10) are available immediately,
    while the rest continue extracting in the background.
    """
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

    # Stage 1: Extract prioritized files directly to output directory
    # This makes them immediately available for reading
    out_dir.mkdir(parents=True, exist_ok=True)
    
    if first_stage:
        extract_entries(archive, out_dir, first_stage)
        
        if fail_after_prioritized:
            raise RuntimeError("Simulated failure after prioritized extraction")
    
    # Stage 2: Extract remaining files to temp dir, then merge
    if second_stage:
        work_dir = Path(tempfile.mkdtemp(prefix="stepwise-"))
        try:
            extract_entries(archive, work_dir, second_stage)
            
            # Merge second stage files into output directory
            for file_path in work_dir.rglob("*"):
                if file_path.is_file():
                    relative_path = file_path.relative_to(work_dir)
                    dest_path = out_dir / relative_path
                    dest_path.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(file_path), str(dest_path))
        except Exception:
            # Clean up temp dir on error, but keep first stage files
            shutil.rmtree(work_dir, ignore_errors=True)
            raise
        finally:
            # Clean up temp dir if it still exists
            if work_dir.exists():
                shutil.rmtree(work_dir, ignore_errors=True)

    return StepwiseExtractResult(
        first_stage_extracted=first_stage,
        second_stage_extracted=second_stage,
        output_dir=out_dir,
    )
