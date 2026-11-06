from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    redis_url: str = "redis://redis:6379/0"
    cors_origins: str = "http://localhost:5173"
    storage_dir: Path = Path("/data")
    local_dev: bool = False
    max_file_size: int = 50 * 1024 * 1024
    file_ttl_seconds: int = 60 * 60
    rate_limit: str = "20/minute"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
