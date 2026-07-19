from __future__ import annotations

import json
import re
import shlex
import ssl
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs
from urllib.request import Request, urlopen

import certifi


PGN_INFO_URL = "https://www.chess.com/callback/game/pgn-info"


class PgnInfoError(RuntimeError):
    """Raised when Chess.com pgn-info enrichment cannot be completed."""


@dataclass(slots=True)
class PgnInfoAuth:
    headers: dict[str, str]
    cookie: str
    token: str | None = None


@dataclass(slots=True)
class PgnInfoCurlValidation:
    ok: bool
    endpoint_found: bool
    cookie_found: bool
    token_found: bool
    data_found: bool
    header_count: int
    issues: list[str]
    message: str


@dataclass(slots=True)
class _ParsedCurlParts:
    headers: dict[str, str]
    cookie: str
    token: str | None
    endpoint_found: bool
    data_found: bool
    header_count: int


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
            with urlopen(request, timeout=self.timeout_seconds, context=_ssl_context()) as response:
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
    parsed = _parse_curl_parts(curl_text)
    if not parsed.cookie:
        raise PgnInfoError("The copied cURL does not contain a Cookie block.")
    return PgnInfoAuth(headers=parsed.headers, cookie=parsed.cookie, token=parsed.token)


def validate_curl_text(curl_text: str) -> PgnInfoCurlValidation:
    try:
        parsed = _parse_curl_parts(curl_text)
    except ValueError as exc:
        return PgnInfoCurlValidation(
            ok=False,
            endpoint_found=False,
            cookie_found=False,
            token_found=False,
            data_found=False,
            header_count=0,
            issues=[str(exc)],
            message="The pasted cURL could not be read. Copy it again as cURL (bash) if possible.",
        )

    issues: list[str] = []
    if not parsed.endpoint_found:
        issues.append("Expected Chess.com pgn-info endpoint was not found.")
    if not parsed.cookie:
        issues.append("Cookie block was not found.")
    if not parsed.token:
        issues.append("CSRF token was not found; the app will still try the request if cookies are present.")
    if not parsed.data_found:
        issues.append("Request body was not found; the app will rebuild the pgn-info body during import.")

    ok = bool(parsed.cookie)
    message = (
        "cURL is ready to save. Cookies were found and will stay local."
        if ok
        else "cURL is missing the Cookie block needed for authenticated Chess.com enrichment."
    )
    return PgnInfoCurlValidation(
        ok=ok,
        endpoint_found=parsed.endpoint_found,
        cookie_found=bool(parsed.cookie),
        token_found=bool(parsed.token),
        data_found=parsed.data_found,
        header_count=parsed.header_count,
        issues=issues,
        message=message,
    )


def _parse_curl_parts(curl_text: str) -> _ParsedCurlParts:
    normalized = _normalize_curl_text(curl_text)
    if not normalized:
        raise ValueError("No cURL text was provided.")

    try:
        args = shlex.split(normalized, posix=True)
    except ValueError as exc:
        raise ValueError(f"cURL quoting is incomplete: {exc}") from exc

    headers: dict[str, str] = {}
    cookie = ""
    data_values: list[str] = []
    endpoint_found = any(PGN_INFO_URL in arg for arg in args)

    idx = 0
    while idx < len(args):
        arg = args[idx]
        next_value = args[idx + 1] if idx + 1 < len(args) else None

        if arg in {"-H", "--header"} and next_value is not None:
            _capture_header(next_value, headers)
            idx += 2
            continue
        if arg.startswith("--header="):
            _capture_header(arg.split("=", 1)[1], headers)
            idx += 1
            continue
        if arg.startswith("-H") and len(arg) > 2:
            _capture_header(arg[2:], headers)
            idx += 1
            continue

        if arg in {"-b", "--cookie"} and next_value is not None:
            cookie = next_value
            idx += 2
            continue
        if arg.startswith("--cookie="):
            cookie = arg.split("=", 1)[1]
            idx += 1
            continue
        if arg.startswith("-b") and len(arg) > 2:
            cookie = arg[2:]
            idx += 1
            continue

        if arg in {"--data", "--data-raw", "--data-binary", "--json"} and next_value is not None:
            data_values.append(next_value)
            idx += 2
            continue
        if arg.startswith(("--data=", "--data-raw=", "--data-binary=", "--json=")):
            data_values.append(arg.split("=", 1)[1])
            idx += 1
            continue

        idx += 1

    header_cookie = _case_insensitive_get(headers, "cookie")
    if header_cookie:
        cookie = header_cookie
        headers = {key: value for key, value in headers.items() if key.lower() != "cookie"}

    token = _extract_token(data_values) or _case_insensitive_get(headers, "x-chesscom-csrf-token")
    allowed_headers = {
        "accept",
        "accept-language",
        "content-type",
        "origin",
        "referer",
        "user-agent",
        "x-chesscom-csrf-token",
    }
    safe_headers = {key: value for key, value in headers.items() if key.lower() in allowed_headers}
    return _ParsedCurlParts(
        headers=safe_headers,
        cookie=cookie,
        token=token,
        endpoint_found=endpoint_found,
        data_found=bool(data_values),
        header_count=len(safe_headers),
    )


def _normalize_curl_text(curl_text: str) -> str:
    text = curl_text.strip().replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\^\s*\n", " ", text)
    text = re.sub(r"`\s*\n", " ", text)
    text = re.sub(r"\\\s*\n", " ", text)
    return text


def _capture_header(header_text: str, headers: dict[str, str]) -> None:
    if ":" not in header_text:
        return
    key, value = header_text.split(":", 1)
    key = key.strip()
    value = value.strip()
    if key:
        headers[key] = value


def _case_insensitive_get(values: dict[str, str], wanted_key: str) -> str | None:
    wanted = wanted_key.lower()
    for key, value in values.items():
        if key.lower() == wanted:
            return value
    return None


def _extract_token(data_values: list[str]) -> str | None:
    for raw in reversed(data_values):
        text = raw.strip()
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            payload = None
        if isinstance(payload, dict) and isinstance(payload.get("_token"), str):
            return payload["_token"]
        parsed_qs = parse_qs(text)
        token_values = parsed_qs.get("_token")
        if token_values:
            return token_values[0]
    return None


def _ssl_context() -> ssl.SSLContext:
    return ssl.create_default_context(cafile=certifi.where())


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
