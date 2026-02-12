from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from app.file_processing._archive_backend import extract_single_to_temp_file, list_entries

IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif")


@dataclass(slots=True)
class ThumbnailResult:
    source_entry: str
    output_path: Path


def generate_first_image_thumbnail(
    archive_path: str | Path,
    output_path: str | Path,
    *,
    height: int = 350,
) -> ThumbnailResult:
    archive = Path(archive_path)
    output = Path(output_path)

    entries = sorted(list_entries(archive))
    selected = next((name for name in entries if name.lower().endswith(IMAGE_SUFFIXES)), None)
    if selected is None:
        raise FileNotFoundError("No image found in archive")

    extracted = extract_single_to_temp_file(archive, selected)
    temp_root = extracted.parents[len(Path(selected).parts) - 1]
    try:
        output.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(extracted) as source_image:
            ratio = height / source_image.height
            width = max(int(source_image.width * ratio), 1)
            thumbnail = source_image.resize((width, height), Image.Resampling.LANCZOS)
            thumbnail.save(output)
    finally:
        shutil.rmtree(temp_root, ignore_errors=True)

    return ThumbnailResult(source_entry=selected, output_path=output)
