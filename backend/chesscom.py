from __future__ import annotations

import asyncio
from typing import Any

import httpx

from backend.config import Settings


class ChessComService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def connect(self, username: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        headers = {"User-Agent": self.settings.chesscom_user_agent}
        timeout = httpx.Timeout(20.0, connect=8.0)
        async with httpx.AsyncClient(headers=headers, timeout=timeout, follow_redirects=True) as client:
            profile_response = await client.get(f"https://api.chess.com/pub/player/{username}")
            self._raise(profile_response)
            archives_response = await client.get(f"https://api.chess.com/pub/player/{username}/games/archives")
            self._raise(archives_response)
            archives = archives_response.json().get("archives", [])
            games: list[dict[str, Any]] = []
            for archive_url in reversed(archives):
                response = await client.get(str(archive_url))
                self._raise(response)
                games.extend(game for game in response.json().get("games", []) if _is_bughouse(game))
                await asyncio.sleep(0.08)
            return profile_response.json(), games

    @staticmethod
    def _raise(response: httpx.Response) -> None:
        if response.status_code == 404:
            raise ValueError("Chess.com profile not found")
        if response.status_code == 429:
            raise RuntimeError("Chess.com rate limit reached. Try again shortly.")
        response.raise_for_status()


def _is_bughouse(game: dict[str, Any]) -> bool:
    pgn = str(game.get("pgn") or "").lower()
    return (
        str(game.get("rules") or "").lower() == "bughouse"
        or str(game.get("variant") or "").lower() == "bughouse"
        or '[variant "bughouse"]' in pgn
        or '[rules "bughouse"]' in pgn
    )
