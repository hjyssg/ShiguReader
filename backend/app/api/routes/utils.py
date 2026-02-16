from fastapi import APIRouter

router = APIRouter(prefix="/utils", tags=["utils"])


# 接口说明：健康检查。
@router.get("/health-check/")
async def health_check() -> bool:
    return True
