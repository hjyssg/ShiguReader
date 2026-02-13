from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(tags=["settings"])


class SettingsResponse(BaseModel):
    favorite_dir: str


class SettingsUpdate(BaseModel):
    favorite_dir: str


@router.get("/settings", response_model=SettingsResponse)
def get_settings() -> Any:
    """Get current settings."""
    return SettingsResponse(favorite_dir=settings.FAVORITE_DIR)


@router.put("/settings", response_model=SettingsResponse)
def update_settings(settings_update: SettingsUpdate) -> Any:
    """Update settings in .env file."""
    favorite_dir = settings_update.favorite_dir.strip()
    
    # Validate path if not empty
    if favorite_dir:
        try:
            path = Path(favorite_dir).resolve()
            if not path.exists():
                raise HTTPException(status_code=400, detail="Path does not exist")
            if not path.is_dir():
                raise HTTPException(status_code=400, detail="Path is not a directory")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid path: {str(e)}")
    
    # Update .env file
    env_path = Path(__file__).parent.parent.parent.parent.parent / ".env"
    
    if not env_path.exists():
        raise HTTPException(status_code=500, detail=".env file not found")
    
    try:
        # Read current .env content
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        # Update or add FAVORITE_DIR
        updated = False
        for i, line in enumerate(lines):
            if line.strip().startswith("FAVORITE_DIR="):
                lines[i] = f"FAVORITE_DIR={favorite_dir}\n"
                updated = True
                break
        
        if not updated:
            # Add new line if not exists
            lines.append(f"FAVORITE_DIR={favorite_dir}\n")
        
        # Write back to .env
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
        
        # Update in-memory settings
        settings.FAVORITE_DIR = favorite_dir
        
        return SettingsResponse(favorite_dir=favorite_dir)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update .env file: {str(e)}")
