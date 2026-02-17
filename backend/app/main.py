import sentry_sdk
from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import HTTPException
from starlette.middleware.cors import CORSMiddleware
from pathlib import Path
import sys

from app.api.main import api_router
from app.api.routes.fs import clear_extract_cache, trigger_favorite_scan, trigger_file_db_sync
from app.core.config import settings
from app.index_db import ensure_index_db_initialized
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)


def custom_generate_unique_id(route: APIRoute) -> str:
    if route.tags:
        return f"{route.tags[0]}-{route.name}"
    return route.name


if settings.SENTRY_DSN and settings.ENVIRONMENT != "local":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
)


@app.on_event("startup")
def startup_index_db() -> None:
    ensure_index_db_initialized()
    clear_extract_cache()
    trigger_favorite_scan()
    trigger_file_db_sync()

# Set all CORS enabled origins
cors_options = {
    "allow_origins": settings.all_cors_origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}

# 本地开发场景允许常见局域网源（含端口），避免仅 localhost 时 LAN 调试被 CORS 拦截。
# 仅在 ENVIRONMENT=local 生效，staging/production 仍走显式白名单。
if settings.ENVIRONMENT == "local":
    cors_options["allow_origin_regex"] = (
        r"^https?://"
        r"(?:localhost|127\.0\.0\.1|\[::1\]"
        r"|10(?:\.\d{1,3}){3}"
        r"|192\.168(?:\.\d{1,3}){2}"
        r"|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})"
        r"(?::\d+)?$"
    )

app.add_middleware(CORSMiddleware, **cors_options)

app.include_router(api_router, prefix=settings.API_V1_STR)

# Serve frontend static files
# When running as PyInstaller bundle, frontend files are in sys._MEIPASS
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    frontend_path = Path(sys._MEIPASS) / "frontend" / "dist"
else:
    # Running in development
    frontend_path = Path(__file__).parent.parent.parent / "frontend" / "dist"

if frontend_path.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_path / "assets")), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
def frontend_spa_fallback(full_path: str):
    """Serve SPA entry for frontend routes such as /read, /explorer, etc."""
    if not frontend_path.exists():
        raise HTTPException(status_code=404, detail="Frontend bundle not found")

    # API routes should be handled by api_router; fallback keeps clear 404 for unexpected misses
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")

    # Allow direct static file access under dist root (favicon, manifest, etc.)
    requested_file = frontend_path / full_path
    if full_path and requested_file.is_file():
        return FileResponse(str(requested_file))

    index_file = frontend_path / "index.html"
    return FileResponse(str(index_file))
