from __future__ import annotations

import re
from urllib.parse import urlsplit


_SUPPORTED_PATH = re.compile(r"^/(?:game/live|live/game)/([1-9][0-9]{0,19})/?$")


def normalize_chesscom_game_url(value: str) -> str:
    """Return the external game ID for a supported public Chess.com live-game URL."""
    candidate = value.strip()
    try:
        parsed = urlsplit(candidate)
    except ValueError as exc:
        raise ValueError("Enter a supported Chess.com live-game URL") from exc

    if (
        parsed.scheme.lower() != "https"
        or parsed.netloc.lower() != "www.chess.com"
        or parsed.username is not None
        or parsed.password is not None
        or parsed.fragment
    ):
        raise ValueError("Enter a supported Chess.com live-game URL")
    match = _SUPPORTED_PATH.fullmatch(parsed.path)
    if not match:
        raise ValueError("Enter a supported Chess.com live-game URL")
    return match.group(1)


def canonical_chesscom_game_urls(external_game_id: str) -> tuple[str, str]:
    if not re.fullmatch(r"[1-9][0-9]{0,19}", external_game_id):
        raise ValueError("Invalid Chess.com game ID")
    return (
        f"https://www.chess.com/game/live/{external_game_id}",
        f"https://www.chess.com/live/game/{external_game_id}",
    )
