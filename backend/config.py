from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_DIR / ".env", extra="ignore")

    app_name: str = "Bughouse AI Coach"
    environment: str = "development"
    database_url: str = f"sqlite:///{(ROOT_DIR / 'data' / 'webapp.db').as_posix()}"
    legacy_database_path: Path = ROOT_DIR / "data" / "bughouse.db"
    fairy_stockfish_path: Path = ROOT_DIR / "engines" / "fairy-stockfish.exe"
    chesscom_user_agent: str = "BughouseAICoach/1.0 contact=admin@example.com"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    max_pgn_bytes: int = 2_000_000
    engine_depth: int = Field(default=10, ge=4, le=24)
    engine_timeout_seconds: float = Field(default=8.0, ge=1, le=60)
    room_ttl_hours: int = Field(default=168, ge=1, le=2160)

    @property
    def cors_origin_list(self) -> list[str]:
        return [value.strip() for value in self.cors_origins.split(",") if value.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
