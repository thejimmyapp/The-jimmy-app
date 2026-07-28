from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import shutil

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[1]


def _default_fairy_stockfish_path() -> Path:
    bundled = ROOT_DIR / "engines" / "fairy-stockfish"
    if bundled.exists():
        return bundled
    installed = shutil.which("fairy-stockfish")
    if installed:
        return Path(installed)
    return ROOT_DIR / "engines" / "fairy-stockfish.exe"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_DIR / ".env", extra="ignore")

    app_name: str = "The Jimmy App — Collaborative Bughouse Coach"
    environment: str = "development"
    database_url: str = f"sqlite:///{(ROOT_DIR / 'data' / 'webapp.db').as_posix()}"
    legacy_database_path: Path = ROOT_DIR / "data" / "bughouse.db"
    fairy_stockfish_path: Path = Field(default_factory=_default_fairy_stockfish_path)
    chesscom_user_agent: str = "thejimmyapp/1.0 contact=hello@thejimmyapp.com"
    chesscom_cache_ttl_seconds: int = Field(default=900, ge=60, le=86_400)
    chesscom_max_archives: int = Field(default=12, ge=1, le=120)
    chesscom_max_games: int = Field(default=500, ge=1, le=5000)
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
