from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


USER_AGENT = "BughouseCoachAI/0.1 (+local Streamlit app)"


@dataclass(slots=True)
class DiscoverySourceResult:
    name: str
    url: str
    status: str
    detail: str
    evidence: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class BughouseDiscoveryReport:
    game_id: int
    game_url: str
    known_players: list[str]
    candidates: list[dict[str, Any]]
    sources: list[DiscoverySourceResult]
    conclusion: str
    partner_found: str | None = None
    second_board_url: str | None = None


def discover_full_bughouse_data(game: dict[str, object], timeout_seconds: int = 20) -> BughouseDiscoveryReport:
    raw = _raw_json(game)
    game_url = str(game.get("url") or raw.get("url") or "")
    known_players = _known_players(game, raw)
    end_time = _safe_int(game.get("end_time") or raw.get("end_time"))
    sources: list[DiscoverySourceResult] = []
    candidates: list[dict[str, Any]] = []

    if game_url:
        sources.append(_inspect_game_page(game_url, timeout_seconds))

    for username in known_players:
        if not end_time:
            continue
        archive_page_url = f"https://www.chess.com/games/archive/{username.lower()}?gameType=bughouse&gameOwner=other_game"
        sources.append(_inspect_archive_page(archive_page_url, game_url, timeout_seconds))
        year, month = _year_month(end_time)
        archive_url = f"https://api.chess.com/pub/player/{username.lower()}/games/{year:04d}/{month:02d}"
        result, archive_candidates = _inspect_month_archive(
            archive_url=archive_url,
            source_username=username,
            target_url=game_url,
            target_uuid=str(raw.get("uuid") or game.get("uuid") or ""),
            target_end_time=end_time,
            known_players=known_players,
            near_window_seconds=60,
            timeout_seconds=timeout_seconds,
        )
        sources.append(result)
        candidates.extend(archive_candidates)

        pgn_url = f"{archive_url}/pgn"
        sources.append(_inspect_month_pgn(pgn_url, game_url, timeout_seconds))

    partner_found = _infer_partner(candidates, known_players)
    second_board = _infer_second_board(candidates, game_url)
    if second_board:
        conclusion = "possible_second_board_found"
    elif partner_found:
        conclusion = "partner_candidate_found_but_second_board_missing"
    else:
        conclusion = "not_found_in_public_sources_checked"

    return BughouseDiscoveryReport(
        game_id=int(game.get("id") or 0),
        game_url=game_url,
        known_players=known_players,
        candidates=candidates,
        sources=sources,
        conclusion=conclusion,
        partner_found=partner_found,
        second_board_url=second_board,
    )


def _inspect_game_page(url: str, timeout_seconds: int) -> DiscoverySourceResult:
    try:
        html = _fetch_text(url, timeout_seconds)
    except Exception as exc:
        return DiscoverySourceResult("game_page", url, "error", str(exc))

    lower = html.lower()
    signals = {
        "html_length": len(html),
        "mentions_bughouse": "bughouse" in lower,
        "mentions_partner": "partner" in lower,
        "mentions_tcn": "tcn" in lower,
        "game_ids": sorted(set(re.findall(r"/game/live/(\d+)", html)))[:20],
        "usernames_in_meta": _extract_meta_players(html),
    }
    has_full = signals["mentions_bughouse"] or signals["mentions_partner"] or signals["mentions_tcn"]
    status = "possible" if has_full else "checked"
    detail = (
        "Page HTML contains possible replay/partner signals."
        if has_full
        else "Logged-out page HTML only exposed public metadata for the current board."
    )
    return DiscoverySourceResult("game_page", url, status, detail, signals)


def _inspect_month_archive(
    archive_url: str,
    source_username: str,
    target_url: str,
    target_uuid: str,
    target_end_time: int,
    known_players: list[str],
    near_window_seconds: int,
    timeout_seconds: int,
) -> tuple[DiscoverySourceResult, list[dict[str, Any]]]:
    try:
        payload = json.loads(_fetch_text(archive_url, timeout_seconds))
    except Exception as exc:
        return DiscoverySourceResult("monthly_archive_json", archive_url, "error", str(exc)), []

    games = payload.get("games") if isinstance(payload, dict) else None
    if not isinstance(games, list):
        return (
            DiscoverySourceResult(
                "monthly_archive_json",
                archive_url,
                "unexpected",
                "Archive response did not contain a games list.",
            ),
            [],
        )

    candidates: list[dict[str, Any]] = []
    for item in games:
        if not isinstance(item, dict) or str(item.get("rules", "")).lower() != "bughouse":
            continue
        item_url = str(item.get("url") or "")
        item_uuid = str(item.get("uuid") or "")
        item_end = _safe_int(item.get("end_time"))
        white = _player_name(item.get("white"))
        black = _player_name(item.get("black"))
        players = [name for name in [white, black] if name]
        delta = abs(item_end - target_end_time) if item_end else None
        is_current = bool(item_url == target_url or (target_uuid and item_uuid == target_uuid))
        is_near = delta is not None and delta <= near_window_seconds
        has_unknown_player = any(player.lower() not in {p.lower() for p in known_players} for player in players)
        if is_current or is_near:
            candidates.append(
                {
                    "source_username": source_username,
                    "url": item_url,
                    "uuid": item_uuid,
                    "end_time": item_end,
                    "delta_seconds": delta,
                    "players": players,
                    "is_current_board": is_current,
                    "is_near_time": is_near,
                    "has_unknown_player": has_unknown_player,
                    "has_tcn": bool(item.get("tcn")),
                    "has_pgn": bool(item.get("pgn")),
                }
            )

    detail = (
        f"Checked {len(games)} games; found {len(candidates)} current/near-time Bughouse records "
        f"within {near_window_seconds}s."
    )
    return (
        DiscoverySourceResult(
            "monthly_archive_json",
            archive_url,
            "checked",
            detail,
            {"games_checked": len(games), "candidates": len(candidates)},
        ),
        candidates,
    )


def _inspect_month_pgn(pgn_url: str, target_url: str, timeout_seconds: int) -> DiscoverySourceResult:
    try:
        text = _fetch_text(pgn_url, timeout_seconds)
    except Exception as exc:
        return DiscoverySourceResult("monthly_archive_pgn", pgn_url, "error", str(exc))

    game_id = target_url.rstrip("/").split("/")[-1] if target_url else ""
    lower = text.lower()
    signals = {
        "text_length": len(text),
        "mentions_game_id": bool(game_id and game_id in text),
        "mentions_bughouse": "bughouse" in lower,
        "mentions_partner": "partner" in lower,
        "game_count_estimate": text.count("[Event "),
    }
    status = "possible" if any([signals["mentions_game_id"], signals["mentions_bughouse"], signals["mentions_partner"]]) else "checked"
    detail = "PGN endpoint returned potentially relevant data." if status == "possible" else "PGN endpoint did not expose relevant Bughouse data."
    return DiscoverySourceResult("monthly_archive_pgn", pgn_url, status, detail, signals)


def _inspect_archive_page(archive_page_url: str, target_url: str, timeout_seconds: int) -> DiscoverySourceResult:
    try:
        html = _fetch_text(archive_page_url, timeout_seconds)
    except Exception as exc:
        return DiscoverySourceResult("games_archive_page", archive_page_url, "error", str(exc))

    target_id = target_url.rstrip("/").split("/")[-1] if target_url else ""
    game_ids = sorted(set(re.findall(r"/game/live/(\d+)", html)))
    member_names = sorted(set(re.findall(r"/member/([A-Za-z0-9_-]+)", html, flags=re.IGNORECASE)))
    target_present = bool(target_id and target_id in game_ids)
    signals = {
        "html_length": len(html),
        "target_game_present": target_present,
        "game_links_seen": len(game_ids),
        "member_names_sample": member_names[:30],
        "mentions_bughouse": "bughouse" in html.lower(),
    }
    detail = (
        "Games archive page contains the target board link but exposes only visible archive-row players."
        if target_present
        else "Games archive page loaded, but target board link was not visible on the first archive page."
    )
    return DiscoverySourceResult("games_archive_page", archive_page_url, "checked", detail, signals)


def _fetch_text(url: str, timeout_seconds: int) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            raw = response.read()
    except HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code}") from exc
    except URLError as exc:
        raise RuntimeError(str(exc.reason)) from exc
    return raw.decode("utf-8", errors="replace")


def _raw_json(game: dict[str, object]) -> dict[str, Any]:
    raw_json = game.get("raw_json")
    if not isinstance(raw_json, str):
        return {}
    try:
        value = json.loads(raw_json)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _known_players(game: dict[str, object], raw: dict[str, Any]) -> list[str]:
    names = [
        game.get("white_username"),
        game.get("black_username"),
        _player_name(raw.get("white")),
        _player_name(raw.get("black")),
    ]
    seen: set[str] = set()
    output: list[str] = []
    for name in names:
        if not name:
            continue
        text = str(name)
        key = text.lower()
        if key not in seen:
            seen.add(key)
            output.append(text)
    return output


def _player_name(value: object) -> str | None:
    if isinstance(value, dict) and value.get("username"):
        return str(value["username"])
    return None


def _safe_int(value: object) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _year_month(timestamp: int) -> tuple[int, int]:
    dt = datetime.fromtimestamp(timestamp, tz=UTC)
    return dt.year, dt.month


def _extract_meta_players(html: str) -> list[str]:
    match = re.search(r"<title>Chess:\s*([^<]+?)\s*-\s*Chess\.com</title>", html)
    if not match:
        return []
    title = match.group(1)
    if " vs " not in title:
        return []
    return [part.strip() for part in title.split(" vs ", 1)]


def _infer_partner(candidates: list[dict[str, Any]], known_players: list[str]) -> str | None:
    known = {name.lower() for name in known_players}
    for candidate in candidates:
        for player in candidate.get("players", []):
            if str(player).lower() not in known:
                return str(player)
    return None


def _infer_second_board(candidates: list[dict[str, Any]], current_url: str) -> str | None:
    for candidate in candidates:
        url = str(candidate.get("url") or "")
        if url and url != current_url and candidate.get("has_unknown_player"):
            return url
    return None
