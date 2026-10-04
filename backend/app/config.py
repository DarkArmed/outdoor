from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Outdoor Planning API"
    app_env: Literal["development", "production"] = "development"
    debug: bool = False
    static_dir: str = ""
    enable_demo_data: bool = False

    database_url: str = "postgresql://outdoor:outdoor@localhost:5432/outdoor"
    database_url_file: str = ""
    secret_key: str = "change-me-in-production"
    secret_key_file: str = ""
    access_token_expire_minutes: int = 60 * 24 * 7

    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    # Both empty with debug=true falls back to mock code2session.
    wechat_miniapp_appid: str = ""
    wechat_miniapp_secret: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        hide_input_in_errors = True

    @model_validator(mode="after")
    def deployment_settings(self):
        for name in ("database_url", "secret_key"):
            filename = getattr(self, name + "_file")
            if filename:
                if name in self.model_fields_set:
                    raise ValueError(f"Set either {name.upper()} or {name.upper()}_FILE")
                try:
                    value = Path(filename).read_text(encoding="utf-8").strip()
                except OSError:
                    raise ValueError(f"Cannot read {name.upper()}_FILE") from None
                if not value:
                    raise ValueError(f"{name.upper()}_FILE must not be empty")
                setattr(self, name, value)
        if self.app_env == "production":
            if self.debug:
                raise ValueError("Production requires DEBUG=false")
            if len(self.secret_key) < 32 or self.secret_key == "change-me-in-production":
                raise ValueError("Production requires an independent SECRET_KEY of at least 32 characters")
            if not self.database_url.startswith(("postgresql://", "postgresql+psycopg2://")):
                raise ValueError("Production requires PostgreSQL")
            if self.database_url == "postgresql://outdoor:outdoor@localhost:5432/outdoor":
                raise ValueError("Production requires an explicit database connection")
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
