from fastapi import APIRouter

from app.api.routes import fs, items, parse, private, users, utils
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(items.router)
api_router.include_router(fs.router)
api_router.include_router(parse.router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
