from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(tags=["settings"])


class SettingsResponse(BaseModel):
    favorite_dir: str
    fs_roots: str
    already_read_dir: str


class SettingsUpdate(BaseModel):
    favorite_dir: str | None = None
    fs_roots: str | None = None
    already_read_dir: str | None = None


def _validate_dir_path(path_str: str, field_name: str) -> None:
    """Validate that a path string points to an existing directory."""
    try:
        path = Path(path_str).resolve()
        if not path.exists():
            raise HTTPException(status_code=400, detail=f"{field_name}: path does not exist: {path_str}")
        if not path.is_dir():
            raise HTTPException(status_code=400, detail=f"{field_name}: path is not a directory: {path_str}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"{field_name}: invalid path: {str(e)}")


def _update_env_key(lines: list[str], key: str, value: str) -> list[str]:
    """Update or append a key=value in .env lines."""
    updated = False
    for i, line in enumerate(lines):
        if line.strip().startswith(f"{key}="):
            lines[i] = f"{key}={value}\n"
            updated = True
            break
    if not updated:
        lines.append(f"{key}={value}\n")
    return lines


@router.get("/settings", response_model=SettingsResponse)
def get_settings() -> Any:
    """Get current settings."""
    return SettingsResponse(
        favorite_dir=settings.FAVORITE_DIR,
        fs_roots=settings.FS_ROOTS,
        already_read_dir=settings.ALREADY_READ_DIR,
    )


@router.put("/settings", response_model=SettingsResponse)
def update_settings(settings_update: SettingsUpdate) -> Any:
    """Update settings in .env file."""
    env_path = Path(__file__).parent.parent.parent.parent.parent / ".env"

    if not env_path.exists():
        raise HTTPException(status_code=500, detail=".env file not found")

    # Collect updates to apply
    updates: dict[str, str] = {}

    # --- favorite_dir ---
    if settings_update.favorite_dir is not None:
        favorite_dir = settings_update.favorite_dir.strip()
        if favorite_dir:
            _validate_dir_path(favorite_dir, "favorite_dir")
        updates["FAVORITE_DIR"] = favorite_dir

    # --- fs_roots (comma-separated list of dirs) ---
    if settings_update.fs_roots is not None:
        fs_roots = settings_update.fs_roots.strip()
        if fs_roots:
            for root in fs_roots.split(","):
                root = root.strip()
                if root:
                    _validate_dir_path(root, "fs_roots")
        updates["FS_ROOTS"] = fs_roots

    # --- already_read_dir ---
    if settings_update.already_read_dir is not None:
        already_read_dir = settings_update.already_read_dir.strip()
        if already_read_dir:
            _validate_dir_path(already_read_dir, "already_read_dir")
        updates["ALREADY_READ_DIR"] = already_read_dir

    if not updates:
        return SettingsResponse(
            favorite_dir=settings.FAVORITE_DIR,
            fs_roots=settings.FS_ROOTS,
            already_read_dir=settings.ALREADY_READ_DIR,
        )

    try:
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        for key, value in updates.items():
            lines = _update_env_key(lines, key, value)

        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(lines)

        # Update in-memory settings
        for key, value in updates.items():
            setattr(settings, key, value)

        return SettingsResponse(
            favorite_dir=settings.FAVORITE_DIR,
            fs_roots=settings.FS_ROOTS,
            already_read_dir=settings.ALREADY_READ_DIR,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update .env file: {str(e)}")
