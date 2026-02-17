from fastapi import APIRouter

from app.api.routes import authors, cosers, fs, history, parse, private, search, tags, utils
from app.api.routes import settings as settings_router
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(utils.router)
api_router.include_router(fs.router)
api_router.include_router(parse.router)
api_router.include_router(search.router)
api_router.include_router(tags.router)
api_router.include_router(authors.router)
api_router.include_router(cosers.router)
api_router.include_router(history.router)
api_router.include_router(settings_router.router)
# 暂时未使用用户相关 API，先注释路由挂载，避免无效维护成本。
# api_router.include_router(users.router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
