import warnings
from typing import Annotated, Any, Literal

from pydantic import (
    AnyUrl,
    BeforeValidator,
    EmailStr,
    HttpUrl,
    PostgresDsn,
    computed_field,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Self


def parse_cors(v: Any) -> list[str] | str:
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",") if i.strip()]
    elif isinstance(v, list | str):
        return v
    raise ValueError(v)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Use top level .env file (one level above ./backend/)
        env_file="../.env",
        env_ignore_empty=True,
        extra="ignore",
    )
    API_V1_STR: str = "/api/v1"
    FRONTEND_HOST: str = "http://localhost:5173"
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"

    BACKEND_CORS_ORIGINS: Annotated[
        list[AnyUrl] | str, BeforeValidator(parse_cors)
    ] = []

    @computed_field  # type: ignore[prop-decorator]
    @property
    def all_cors_origins(self) -> list[str]:
        return [str(origin).rstrip("/") for origin in self.BACKEND_CORS_ORIGINS] + [
            self.FRONTEND_HOST
        ]

    PROJECT_NAME: str
    SENTRY_DSN: HttpUrl | None = None
    # PostgreSQL settings (optional, not used by default - using SQLite instead)
    POSTGRES_SERVER: str = ""
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = ""
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = ""
    # SQLite database URLs
    INDEX_SQLITE_URL: str = "sqlite:///../data/index.db"
    USER_SQLITE_URL: str = "sqlite:///../data/user.db"

    # File System & Thumbnail settings
    FS_ROOTS: str = ""  # Comma-separated list of root directories
    FAVORITE_DIR: str = ""
    THUMB_CACHE_DIR: str = "../data/thumb_cache"
    THUMB_CONCURRENCY: int = 3
    THUMB_TIMEOUT_SEC: int = 10
    THUMB_HEIGHT: int = 350
    THUMB_JPEG_QUALITY: int = 70

    # Image Compression settings
    IMAGE_COMPRESS_MAX_WIDTH: int = 2000  # 最大宽度（像素）
    IMAGE_COMPRESS_MAX_HEIGHT: int = 2000  # 最大高度（像素）
    IMAGE_COMPRESS_MIN_SIZE: int = 1048576  # 最小文件大小（1MB，小于此值不压缩）
    IMAGE_COMPRESS_QUALITY: int = 85  # JPEG 压缩质量（1-100）
    IMAGE_COMPRESS_FORMAT: str = "JPEG"  # 输出格式

    @computed_field  # type: ignore[prop-decorator]
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # Use SQLite instead of PostgreSQL for user data
        return self.USER_SQLITE_URL

    FIRST_SUPERUSER: EmailStr
    FIRST_SUPERUSER_PASSWORD: str

    # def _check_default_secret(self, var_name: str, value: str | None) -> None:
    #     if value == "changethis":
    #         message = (
    #             f'The value of {var_name} is "changethis", '
    #             "for security, please change it, at least for deployments."
    #         )
    #         if self.ENVIRONMENT == "local":
    #             warnings.warn(message, stacklevel=1)
    #         else:
    #             raise ValueError(message)

    @model_validator(mode="after")
    def _enforce_non_default_secrets(self) -> Self:
        # Skip PostgreSQL password check since we're using SQLite
        # self._check_default_secret("POSTGRES_PASSWORD", self.POSTGRES_PASSWORD)
        # self._check_default_secret(
        #     "FIRST_SUPERUSER_PASSWORD", self.FIRST_SUPERUSER_PASSWORD
        # )

        return self


settings = Settings()  # type: ignore
