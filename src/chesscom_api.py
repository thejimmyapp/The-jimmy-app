from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


LOGGER = logging.getLogger(__name__)
API_BASE = "https://api.chess.com/pub"
USER_AGENT = "BughouseCoachAI/0.1 (+local Streamlit app)"


class ChessComApiError(RuntimeError):
    """Raised when Chess.com PubAPI data cannot be fetched or decoded."""


@dataclass(slots=True)
class ChessComClient:
    timeout_seconds: int = 20
    polite_delay_seconds: float = 0.25

    def get_archives(self, username: str) -> list[str]:
        safe_username = username.strip().lower()
        if not safe_username:
            raise ChessComApiError("Chess.com username is required.")

        url = f"{API_BASE}/player/{safe_username}/games/archives"
        payload = self._get_json(url)
        archives = payload.get("archives")
        if not isinstance(archives, list):
            raise ChessComApiError("Chess.com returned an unexpected archives response.")
        return [str(item) for item in archives]

    def get_archive_games(self, archive_url: str) -> list[dict[str, Any]]:
        time.sleep(self.polite_delay_seconds)
        payload = self._get_json(archive_url)
        games = payload.get("games")
        if not isinstance(games, list):
            raise ChessComApiError(f"Archive response did not contain a games list: {archive_url}")
        return [game for game in games if isinstance(game, dict)]

    def is_bughouse_game(self, game: dict[str, Any]) -> bool:
        rules = str(game.get("rules", "")).lower()
        variant = str(game.get("variant", "")).lower()
        pgn = str(game.get("pgn", "")).lower()
        return (
            rules == "bughouse"
            or variant == "bughouse"
            or '[variant "bughouse"]' in pgn
            or '[rules "bughouse"]' in pgn
        )

    def _get_json(self, url: str) -> dict[str, Any]:
        request = Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": USER_AGENT,
            },
        )
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                raw = response.read().decode("utf-8")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
            LOGGER.warning("Chess.com API HTTP error %s for %s: %s", exc.code, url, detail)
            raise ChessComApiError(f"Chess.com API returned HTTP {exc.code} for {url}.") from exc
        except URLError as exc:
            raise ChessComApiError(f"Could not reach Chess.com API: {exc.reason}") from exc
        except TimeoutError as exc:
            raise ChessComApiError(f"Chess.com API request timed out: {url}") from exc

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ChessComApiError(f"Chess.com API returned invalid JSON for {url}.") from exc
        if not isinstance(parsed, dict):
            raise ChessComApiError(f"Chess.com API returned an unexpected payload for {url}.")
        return parsed


PGN_HEADER_RE = re.compile(r'^\[(?P<key>[A-Za-z0-9_]+)\s+"(?P<value>.*)"\]$')


def parse_pgn_headers(pgn: str) -> dict[str, str]:
    headers: dict[str, str] = {}
    for line in pgn.splitlines():
        stripped = line.strip()
        if not stripped:
            break
        match = PGN_HEADER_RE.match(stripped)
        if match:
            headers[match.group("key")] = match.group("value")
    return headers
