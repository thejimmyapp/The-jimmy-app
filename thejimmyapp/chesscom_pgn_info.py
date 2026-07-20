from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


PGN_INFO_URL = "https://www.chess.com/callback/game/pgn-info"


class PgnInfoError(RuntimeError):
    """Raised when Chess.com pgn-info enrichment cannot be completed."""


@dataclass(slots=True)
class PgnInfoAuth:
    headers: dict[str, str]
    cookie: str
    token: str | None = None


@dataclass(slots=True)
class PgnInfoClient:
    auth: PgnInfoAuth
    timeout_seconds: int = 30

    @classmethod
    def from_curl_file(cls, path: Path) -> "PgnInfoClient":
        if not path.exists():
            raise PgnInfoError(f"pgn-info cURL file not found: {path}")
        return cls(auth=parse_curl_auth(path.read_text(encoding="utf-8", errors="replace")))

    def fetch_for_games(self, games: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        payload_games = [_payload_game(game) for game in games]
        payload_games = [item for item in payload_games if item is not None]
        if not payload_games:
            return {}

        payload = {
            "_token": self.auth.token or "",
            "ids": ",".join(item["id"] for item in payload_games),
            "types": ",".join(item["type"] for item in payload_games),
            "uuids": [item["uuid"] for item in payload_games],
        }
        headers = dict(self.auth.headers)
        headers["Cookie"] = self.auth.cookie
        headers.setdefault("Accept", "application/json, text/plain, */*")
        headers.setdefault("Content-Type", "application/json")

        request = Request(
            PGN_INFO_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                raw = response.read().decode("utf-8", errors="replace")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
            raise PgnInfoError(f"Chess.com pgn-info returned HTTP {exc.code}: {detail[:200]}") from exc
        except URLError as exc:
            raise PgnInfoError(f"Could not reach Chess.com pgn-info: {exc.reason}") from exc

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise PgnInfoError("Chess.com pgn-info returned invalid JSON.") from exc
        if not isinstance(parsed, list):
            raise PgnInfoError("Chess.com pgn-info returned an unexpected payload.")

        enriched: dict[str, dict[str, Any]] = {}
        for item in parsed:
            if not isinstance(item, dict):
                continue
            game_id = item.get("gameId")
            if game_id is None:
                continue
            enriched[str(game_id)] = normalize_pgn_info_item(item)
        return enriched


def parse_curl_auth(curl_text: str) -> PgnInfoAuth:
    headers: dict[str, str] = {}
    for key, value in re.findall(r"-H\s+'([^:']+):\s*([^']*)'", curl_text):
        lower = key.lower()
        if lower in {
            "accept",
            "accept-language",
            "content-type",
            "origin",
            "referer",
            "user-agent",
            "x-chesscom-csrf-token",
        }:
            headers[key] = value

    cookie_match = re.search(r"-b\s+'([^']+)'", curl_text, re.S)
    if not cookie_match:
        raise PgnInfoError("The copied cURL does not contain a Cookie block.")
    data_match = re.search(r"--data-raw\s+'([^']*)'", curl_text, re.S)
    token = None
    if data_match:
        try:
            payload = json.loads(data_match.group(1))
            if isinstance(payload.get("_token"), str):
                token = payload["_token"]
        except json.JSONDecodeError:
            pass
    if not token:
        csrf = headers.get("x-chesscom-csrf-token") or headers.get("X-Chesscom-Csrf-Token")
        token = csrf if csrf else None
    return PgnInfoAuth(headers=headers, cookie=cookie_match.group(1), token=token)


def normalize_pgn_info_item(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "chesscom_pgn_info": item,
        "tcn": item.get("tcnMoves"),
        "moveTimestamps": item.get("moveTimestamps"),
        "initial_setup": item.get("initialSetup"),
        "rules": "bughouse" if str(item.get("variant", "")).lower() == "bughouse" else item.get("variant"),
        "variant": item.get("variant"),
        "variant_id": item.get("variantId"),
        "time_control": item.get("timeControl"),
        "pgn_info_start_date": item.get("startDate"),
        "bughousePlayer1Name": item.get("player1Name"),
        "bughousePlayer2Name": item.get("player2Name"),
        "bughousePartnerPlayer1Name": item.get("bughousePartnerPlayer1Name"),
        "bughousePartnerPlayer2Name": item.get("bughousePartnerPlayer2Name"),
        "bughousePartnerTcnMoves": item.get("bughousePartnerTcnMoves"),
        "bughousePartnerMoveTimestamps": item.get("bughousePartnerMoveTimestamps"),
    }


def merge_pgn_info(game: dict[str, Any], pgn_info: dict[str, Any] | None) -> dict[str, Any]:
    if not pgn_info:
        return game
    merged = dict(game)
    for key, value in pgn_info.items():
        if value is not None:
            merged[key] = value
    return merged


def has_partner_board_data(game: dict[str, Any]) -> bool:
    return bool(game.get("bughousePartnerTcnMoves") or game.get("bughouse_partner_tcn_moves"))


def _payload_game(game: dict[str, Any]) -> dict[str, str] | None:
    game_id = _game_id(game)
    uuid = game.get("uuid")
    if not game_id or not isinstance(uuid, str) or not uuid:
        return None
    return {"id": game_id, "uuid": uuid, "type": "game_live"}


def _game_id(game: dict[str, Any]) -> str | None:
    for key in ("game_id", "gameId", "id"):
        value = game.get(key)
        if value is not None:
            return str(value)
    url = str(game.get("url") or "")
    match = re.search(r"/(?:live|daily)/(\d+)", url)
    return match.group(1) if match else None
