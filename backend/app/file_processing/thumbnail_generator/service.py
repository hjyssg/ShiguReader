from __future__ import annotations

import logging
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps

from app.constants import IMAGE_SUFFIXES
from app.core.config import settings
from app.file_processing._archive_backend import extract_single_to_temp_file, list_entries

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ThumbnailResult:
    source_entry: str
    output_path: Path


def _resolve_ffmpeg_executable() -> str:
    """Resolve ffmpeg executable path.

    Priority:
    1) bundled binary: backend/tools/ffmpeg/ffmpeg.exe (or ffmpeg on non-Windows)
    2) PATH lookup via shutil.which("ffmpeg")
    """
    backend_dir = Path(__file__).resolve().parents[3]
    candidates = [
        backend_dir / "tools" / "ffmpeg" / "ffmpeg.exe",
        backend_dir / "tools" / "ffmpeg" / "ffmpeg",
    ]

    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return str(candidate)

    ffmpeg_in_path = shutil.which("ffmpeg")
    if ffmpeg_in_path:
        return ffmpeg_in_path

    tried = ", ".join(str(p) for p in candidates)
    raise FileNotFoundError(f"ffmpeg not found. Tried bundled path(s): {tried}, and PATH")


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
            source_image = ImageOps.exif_transpose(source_image)
            if source_image.mode != "RGB":
                source_image = source_image.convert("RGB")
            ratio = height / source_image.height
            width = max(int(source_image.width * ratio), 1)
            thumbnail = source_image.resize((width, height), Image.Resampling.BILINEAR)
            thumbnail.save(
                output,
                "JPEG",
                quality=settings.THUMB_JPEG_QUALITY,
                optimize=False,
            )
    finally:
        shutil.rmtree(temp_root, ignore_errors=True)

    return ThumbnailResult(source_entry=selected, output_path=output)


def generate_video_thumbnail(
    filepath: Path,
    output_path: Path,
    *,
    timeout: int = 10,
) -> None:
    """Generate video thumbnail using ffmpeg with multiple fallback strategies.
    
    Args:
        filepath: Path to video file
        output_path: Path where thumbnail should be saved
        timeout: Timeout in seconds for ffmpeg execution
        
    Raises:
        FileNotFoundError: If ffmpeg is not found
        subprocess.TimeoutExpired: If ffmpeg execution times out
        RuntimeError: If all ffmpeg strategies failed
    """
    ffmpeg_bin = _resolve_ffmpeg_executable()

    attempts = [
        [
            ffmpeg_bin,
            "-y",
            "-ss",
            "3",
            "-i",
            str(filepath),
            "-frames:v",
            "1",
            str(output_path),
        ],
        [
            ffmpeg_bin,
            "-y",
            "-i",
            str(filepath),
            "-vf",
            "select=eq(n\\,0)",
            "-vframes",
            "1",
            str(output_path),
        ],
    ]

    last_err = ""
    for command in attempts:
        try:
            result = subprocess.run(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
                text=True,
                encoding="utf-8",
                errors="ignore",
                timeout=timeout,
            )
            
            if output_path.exists() and output_path.stat().st_size > 0:
                return
            
            if result.stderr:
                last_err = result.stderr.strip()
        except FileNotFoundError:
            last_err = f"ffmpeg not found: {command[0]}"
            raise FileNotFoundError(last_err)
        except subprocess.TimeoutExpired as e:
            last_err = "ffmpeg timeout"
            raise

    raise RuntimeError(f"All ffmpeg strategies failed: {last_err[:200]}")


def generate_svg_placeholder(output_path: Path) -> None:
    """Generate SVG placeholder for video files.
    
    Args:
        output_path: Path where SVG should be saved
    """
    svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#1a1a1a"/>
  <circle cx="200" cy="150" r="40" fill="#ffffff" opacity="0.8"/>
  <polygon points="190,135 190,165 215,150" fill="#1a1a1a"/>
  <text x="200" y="200" font-family="Arial" font-size="14" fill="#ffffff" text-anchor="middle" opacity="0.6">Video</text>
</svg>'''
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(svg_content, encoding="utf-8")


def generate_video_placeholder(output_path: Path) -> None:
    """Generate fast JPEG placeholder for video files."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.new("RGB", (400, 300), color=(26, 26, 26)) as img:
        img.save(
            output_path,
            "JPEG",
            quality=settings.THUMB_JPEG_QUALITY,
            optimize=False,
        )


def generate_image_thumbnail(
    filepath: Path,
    output_path: Path,
    *,
    height: int = 350,
) -> None:
    """Generate thumbnail from image file.
    
    Args:
        filepath: Path to image file
        output_path: Path where thumbnail should be saved
        height: Target height for thumbnail (width calculated to maintain aspect ratio)
        
    Raises:
        Exception: If image processing fails
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with Image.open(filepath) as img_raw:
        img = ImageOps.exif_transpose(img_raw)
        
        # Handle transparency
        if img.mode in ("RGBA", "LA"):
            rgba = img.convert("RGBA")
            background = Image.new("RGB", rgba.size, (255, 255, 255))
            background.paste(rgba, mask=rgba.split()[-1])
            img = background
        elif img.mode == "P":
            if "transparency" in img.info:
                rgba = img.convert("RGBA")
                background = Image.new("RGB", rgba.size, (255, 255, 255))
                background.paste(rgba, mask=rgba.split()[-1])
                img = background
            else:
                img = img.convert("RGB")
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Resize by target height while maintaining aspect ratio.
        # 不限制最大宽度，避免宽图被 thumbnail((400, h)) 压低高度导致测试失败。
        ratio = height / img.height
        width = max(int(img.width * ratio), 1)
        img = img.resize((width, height), Image.Resampling.BILINEAR)
        # 统一输出 JPEG：编码更快、解码兼容性更好，缓存命中链路也统一为 .jpg。
        img.save(
            output_path,
            "JPEG",
            quality=settings.THUMB_JPEG_QUALITY,
            optimize=False,
        )
