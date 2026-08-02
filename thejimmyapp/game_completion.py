from __future__ import annotations

import json
import re
from typing import Any

from thejimmyapp.chesscom_api import parse_pgn_headers


TERMINAL_PGN_RESULTS = {"1-0", "0-1", "1/2-1/2"}
TERMINAL_PLAYER_RESULTS = {
    "win",
    "agreed",
    "repetition",
    "stalemate",
    "insufficient",
    "50move",
    "timevsinsufficient",
    "checkmated",
    "resigned",
    "timeout",
    "abandoned",
    "lose",
    "kingofthehill",
    "threecheck",
}
TERMINAL_STORED_RESULTS = {"win", "loss", "draw"}
_MOVETEXT_RESULT_RE = re.compile(r"(?:^|\s)(1-0|0-1|1/2-1/2)\s*$")


def pgn_result(pgn: str) -> str | None:
    header_result = parse_pgn_headers(pgn).get("Result")
    if header_result in TERMINAL_PGN_RESULTS:
        return header_result
    match = _MOVETEXT_RESULT_RE.search(pgn.strip())
    return match.group(1) if match else None


def is_completed_pgn(pgn: str) -> bool:
    return pgn_result(pgn) in TERMINAL_PGN_RESULTS


def player_results(result: str) -> tuple[str, str]:
    if result == "1-0":
        return "win", "checkmated"
    if result == "0-1":
        return "checkmated", "win"
    if result == "1/2-1/2":
        return "agreed", "agreed"
    raise ValueError("PGN does not contain a terminal result")


def is_completed_chesscom_game(game: dict[str, Any]) -> bool:
    if is_completed_pgn(str(game.get("pgn") or "")):
        return True
    white = game.get("white") if isinstance(game.get("white"), dict) else {}
    black = game.get("black") if isinstance(game.get("black"), dict) else {}
    white_result = str(white.get("result") or "").lower()
    black_result = str(black.get("result") or "").lower()
    try:
        has_end_time = int(game.get("end_time") or 0) > 0
    except (TypeError, ValueError):
        has_end_time = False
    return has_end_time and white_result in TERMINAL_PLAYER_RESULTS and black_result in TERMINAL_PLAYER_RESULTS


def is_completed_stored_game(game: dict[str, object]) -> bool:
    if str(game.get("result") or "").lower() in TERMINAL_STORED_RESULTS:
        return True
    if is_completed_pgn(str(game.get("pgn") or "")):
        return True
    try:
        raw = json.loads(str(game.get("raw_json") or "{}"))
    except json.JSONDecodeError:
        return False
    return isinstance(raw, dict) and is_completed_chesscom_game(raw)
