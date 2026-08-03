from __future__ import annotations

import asyncio
from copy import deepcopy
import time
from typing import Any

import httpx

from backend.config import Settings
from thejimmyapp.game_completion import is_completed_chesscom_game


_request_lock = asyncio.Lock()
_connection_cache: dict[str, tuple[float, dict[str, Any], list[dict[str, Any]]]] = {}


class ChessComService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def connect(self, username: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        cache_key = username.lower()
        cached = _connection_cache.get(cache_key)
        if cached and time.monotonic() - cached[0] < self.settings.chesscom_cache_ttl_seconds:
            return deepcopy(cached[1]), deepcopy(cached[2])

        headers = {"User-Agent": self.settings.chesscom_user_agent}
        timeout = httpx.Timeout(20.0, connect=8.0)
        async with _request_lock:
            cached = _connection_cache.get(cache_key)
            if cached and time.monotonic() - cached[0] < self.settings.chesscom_cache_ttl_seconds:
                return deepcopy(cached[1]), deepcopy(cached[2])

            async with httpx.AsyncClient(headers=headers, timeout=timeout, follow_redirects=True) as client:
                profile_response = await client.get(f"https://api.chess.com/pub/player/{username}")
                self._raise(profile_response)
                archives_response = await client.get(f"https://api.chess.com/pub/player/{username}/games/archives")
                self._raise(archives_response)
                archives = archives_response.json().get("archives", [])
                games: list[dict[str, Any]] = []
                for archive_url in list(reversed(archives))[: self.settings.chesscom_max_archives]:
                    response = await client.get(str(archive_url))
                    self._raise(response)
                    games.extend(
                        game
                        for game in response.json().get("games", [])
                        if _is_bughouse(game) and is_completed_chesscom_game(game)
                    )
                    if len(games) >= self.settings.chesscom_max_games:
                        games = games[: self.settings.chesscom_max_games]
                        break
                    await asyncio.sleep(0.25)
                profile = profile_response.json()
                _connection_cache[cache_key] = (time.monotonic(), deepcopy(profile), deepcopy(games))
                return profile, games

    @staticmethod
    def _raise(response: httpx.Response) -> None:
        if response.status_code == 404:
            raise ValueError("Chess.com profile not found")
        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After")
            suffix = f" Retry after {retry_after} seconds." if retry_after and retry_after.isdigit() else ""
            raise RuntimeError(f"Chess.com rate limit reached. No further requests were sent.{suffix}")
        response.raise_for_status()


def _is_bughouse(game: dict[str, Any]) -> bool:
    pgn = str(game.get("pgn") or "").lower()
    return (
        str(game.get("rules") or "").lower() == "bughouse"
        or str(game.get("variant") or "").lower() == "bughouse"
        or '[variant "bughouse"]' in pgn
        or '[rules "bughouse"]' in pgn
    )
