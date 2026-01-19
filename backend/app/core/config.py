from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, Field
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = Field(default="AppTrust Manager")
    api_prefix: str = Field(default="/api")
    database_url: str = Field(default="sqlite:///./apptrust.db")

    jfrog_base_url: AnyHttpUrl = Field(
        default="https://example.jfrog.io", alias="JFROG_BASE_URL"
    )
    jfrog_api_token: str = Field(default="changeme", alias="JFROG_API_TOKEN")
    jfrog_project_key: Optional[str] = Field(
        default=None, alias="JFROG_PROJECT_KEY"
    )

    opa_binary_path: Optional[str] = Field(
        default=None, alias="OPA_BINARY_PATH"
    )
    default_author: str = Field(default="system", alias="DEFAULT_AUTHOR")


@lru_cache()
def get_settings() -> Settings:
    return Settings()  # type: ignore[arg-type]
