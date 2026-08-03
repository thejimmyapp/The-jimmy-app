from __future__ import annotations

import asyncio
from copy import deepcopy
import re
import time
from typing import Any
from urllib.parse import urlsplit

import httpx

from backend.config import Settings
from backend.game_resolution import normalize_chesscom_game_url
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

    async def find_exact_game(self, username: str, external_game_id: str) -> dict[str, Any] | None:
        """Search a bounded set of official public archives and return only an exact match."""
        headers = {"User-Agent": self.settings.chesscom_user_agent}
        timeout = httpx.Timeout(20.0, connect=8.0)
        async with _request_lock:
            async with httpx.AsyncClient(headers=headers, timeout=timeout, follow_redirects=False) as client:
                archives_response = await client.get(f"https://api.chess.com/pub/player/{username}/games/archives")
                self._raise(archives_response)
                archive_urls = archives_response.json().get("archives", [])
                for archive_url in list(reversed(archive_urls))[: self.settings.chesscom_max_archives]:
                    safe_archive_url = str(archive_url)
                    if not _is_official_archive_url(safe_archive_url, username):
                        continue
                    response = await client.get(safe_archive_url)
                    self._raise(response)
                    for game in response.json().get("games", []):
                        if not _is_bughouse(game) or not is_completed_chesscom_game(game):
                            continue
                        try:
                            candidate_id = normalize_chesscom_game_url(str(game.get("url") or ""))
                        except ValueError:
                            continue
                        if candidate_id == external_game_id:
                            return game
                    await asyncio.sleep(0.25)
        return None

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


def _is_official_archive_url(value: str, username: str) -> bool:
    parsed = urlsplit(value)
    if parsed.scheme != "https" or parsed.netloc != "api.chess.com" or parsed.query or parsed.fragment:
        return False
    expected_prefix = f"/pub/player/{username.lower()}/games/"
    return parsed.path.lower().startswith(expected_prefix) and bool(
        re.fullmatch(r"[0-9]{4}/(?:0[1-9]|1[0-2])", parsed.path[len(expected_prefix) :])
    )
