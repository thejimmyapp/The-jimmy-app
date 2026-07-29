from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import os
import shutil

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[1]


def _runtime_data_dir() -> Path:
    mount = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH")
    return Path(mount) if mount else ROOT_DIR / "data"


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
    chesscom_user_agent: str = "thejimmyapp/1.0 contact=admin@example.com"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    max_pgn_bytes: int = 2_000_000
    engine_depth: int = Field(default=10, ge=4, le=24)
    engine_timeout_seconds: float = Field(default=8.0, ge=1, le=60)
    room_ttl_hours: int = Field(default=168, ge=1, le=2160)
    qwen_enabled: bool = True
    qwen_model_name: str = "lmstudio-community/Qwen3.5-4B-GGUF"
    qwen_model_filename: str = "Qwen3.5-4B-Q4_K_M.gguf"
    qwen_model_url: str = (
        "https://huggingface.co/lmstudio-community/Qwen3.5-4B-GGUF/resolve/main/"
        "Qwen3.5-4B-Q4_K_M.gguf?download=true"
    )
    qwen_model_path: Path = Field(
        default_factory=lambda: _runtime_data_dir() / "models" / "Qwen3.5-4B-Q4_K_M.gguf"
    )
    llama_cli_path: Path = ROOT_DIR / "llama" / "llama-cli"
    qwen_context_size: int = Field(default=8192, ge=2048, le=32768)
    qwen_max_tokens: int = Field(default=1200, ge=128, le=4096)
    qwen_temperature: float = Field(default=0.15, ge=0, le=1)
    qwen_top_p: float = Field(default=0.85, gt=0, le=1)
    qwen_reasoning_budget: int = Field(default=0, ge=-1, le=512)
    qwen_threads: int = Field(default=2, ge=1, le=16)
    qwen_timeout_seconds: float = Field(default=300, ge=30, le=900)
    qwen_min_free_bytes: int = 3_200_000_000

    @property
    def cors_origin_list(self) -> list[str]:
        return [value.strip() for value in self.cors_origins.split(",") if value.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
