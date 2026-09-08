from __future__ import annotations

import asyncio
from datetime import UTC, datetime
import json
import time
from typing import Any

import httpx
import pytest

import backend.main as main_module
from backend.chesscom_matchups import (
    ChessComMatchupService,
    MatchExcludedError,
    MatchProxyDisabledError,
)
from backend.config import Settings
from backend.services import GameService


NOW = 1_786_320_000


def callback_board(
    game_id: int,
    uuid: str,
    partner_uuid: str,
    *,
    white: tuple[str, int],
    black: tuple[str, int],
    winner: str,
    reason: str,
    plies: int = 40,
    result_message: str = "ignored free-form text",
    end_time: int = NOW,
) -> dict[str, Any]:
    ended = datetime.fromtimestamp(end_time, UTC)
    return {
        "game": {
            "id": game_id,
            "uuid": uuid,
            "partnerGameId": partner_uuid,
            "plyCount": plies,
            "gameEndReason": reason,
            "colorOfWinner": winner,
            "moveList": "aa" * plies,
            "moveTimestamps": ",".join("100" for _ in range(plies + 1)),
            "baseTime1": 1800,
            "timeIncrement1": 0.0,
            "pgnHeaders": {
                "FEN": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                "Date": ended.strftime("%Y.%m.%d"),
                "EndTime": ended.strftime("%H:%M:%S GMT+0000"),
                "White": white[0],
                "Black": black[0],
                "WhiteElo": white[1],
                "BlackElo": black[1],
                "Result": "1-0" if winner == "white" else "0-1",
                "TimeControl": "180",
            },
            "resultMessage": result_message,
        },
        "players": {
            "top": {"color": "black", "username": black[0], "rating": black[1]},
            "bottom": {"color": "white", "username": white[0], "rating": white[1]},
        },
    }


def rating_class_fixture(
    games_by_player: dict[str, list[int]],
    specs: dict[int, tuple[int, int, int]],
    **setting_overrides: Any,
) -> tuple[ChessComMatchupService, list[str]]:
    callbacks: dict[str, dict[str, Any]] = {}
    for game_id, (top_rating, end_time, plies) in specs.items():
        primary_uuid = f"{game_id:08x}-0000-4000-8000-{game_id:012x}"
        partner_id = game_id + 1000
        partner_uuid = f"{partner_id:08x}-0000-4000-8000-{partner_id:012x}"
        callbacks[str(game_id)] = callback_board(
            game_id,
            primary_uuid,
            partner_uuid,
            white=(f"Top{game_id}", top_rating),
            black=(f"Other{game_id}", max(0, top_rating - 100)),
            winner="white",
            reason="checkmated",
            plies=plies,
            end_time=end_time,
        )
        callbacks[partner_uuid] = callback_board(
            partner_id,
            partner_uuid,
            primary_uuid,
            white=(f"Diagonal{game_id}", max(0, top_rating - 200)),
            black=(f"Partner{game_id}", max(0, top_rating - 50)),
            winner="black",
            reason="bughousepartnerlose",
            plies=plies,
            end_time=end_time,
        )

    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        path = request.url.path
        if path == "/pub/leaderboards":
            payload = {"live_bughouse": []}
        elif path.endswith("/games/2026/08"):
            username = path.split("/")[3]
            payload = {"games": [
                {
                    "rules": "bughouse",
                    "url": f"https://www.chess.com/game/live/{game_id}",
                    "end_time": specs[game_id][1],
                }
                for game_id in games_by_player.get(username, [])
            ]}
        else:
            payload = callbacks[path.rsplit("/", 1)[-1]]
        return httpx.Response(200, json=payload, request=request)

    setting_values = {
        "chesscom_guest_max_archives_per_player": 1,
        "chesscom_guest_max_matches_examined": 100,
        **setting_overrides,
    }
    settings = Settings(**setting_values)
    return ChessComMatchupService(settings, transport=httpx.MockTransport(handler)), requests


def test_match_proxy_fetches_partner_sequentially_normalizes_and_caches_raw_pair() -> None:
    primary_uuid = "ed14d828-9293-11f1-b6b5-6cfe54652c60"
    partner_uuid = "ed14d829-9293-11f1-b6b5-6cfe54652c60"
    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request.url.path)
        if request.url.path.endswith("/180443871315"):
            payload = callback_board(
                180443871315,
                primary_uuid,
                partner_uuid,
                white=("vjbaker", 2799),
                black=("larso", 2677),
                winner="black",
                reason="bughousepartnerlose",
                plies=71,
            )
        else:
            payload = callback_board(
                180443871317,
                partner_uuid,
                primary_uuid,
                white=("littleplotkin", 2608),
                black=("chickencrossroad", 2408),
                winner="white",
                reason="checkmated",
                plies=81,
            )
        return httpx.Response(200, json=payload, request=request)

    service = ChessComMatchupService(Settings(), transport=httpx.MockTransport(handler))
    match = asyncio.run(service.normalized_match(180443871315))
    partner_lookup = asyncio.run(service.normalized_match(180443871317))

    assert requests == [
        "/callback/live/game/180443871315",
        f"/callback/live/game/{partner_uuid}",
    ]
    assert partner_lookup == match
    assert match == {
        "game_ids": {"A": 180443871315, "B": 180443871317},
        "end_time": NOW,
        "seats": {
            "A-white": {"name": "vjbaker", "rating": 2799},
            "A-black": {"name": "larso", "rating": 2677},
            "B-white": {"name": "littleplotkin", "rating": 2608},
            "B-black": {"name": "chickencrossroad", "rating": 2408},
        },
        "ply_counts": {"A": 71, "B": 81},
        "decisive_board": "B",
        "loser_seat": "B-black",
        "action": "checkmated",
        "highest_rated": {"name": "vjbaker", "rating": 2799, "seat": "A-white", "outcome": "LOST"},
        "loser_relative_to_highest": "partner",
    }
    assert "resultMessage" not in match
    assert service._match_cache[180443871315].raw_board_a["game"]["resultMessage"] == "ignored free-form text"

    replay = asyncio.run(service.replay_source(180443871315))
    assert requests == [
        "/callback/live/game/180443871315",
        f"/callback/live/game/{partner_uuid}",
    ]
    assert replay["match"] == match
    assert replay["boards"]["A"] == {
        "id": 180443871315,
        "uuid": primary_uuid,
        "partnerGameId": partner_uuid,
        "moveList": "aa" * 71,
        "moveTimestamps": ",".join("100" for _ in range(72)),
        "plyCount": 71,
        "baseTime1": 1800,
        "timeIncrement1": 0,
        "initialFen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "headers": {
            "White": "vjbaker",
            "Black": "larso",
            "WhiteElo": 2799,
            "BlackElo": 2677,
            "Date": datetime.fromtimestamp(NOW, UTC).strftime("%Y.%m.%d"),
            "EndTime": datetime.fromtimestamp(NOW, UTC).strftime("%H:%M:%S GMT+0000"),
            "Result": "0-1",
            "TimeControl": "180",
        },
    }


def test_match_proxy_fails_closed_for_unknown_terminal_code_even_if_message_looks_valid() -> None:
    first_uuid = "00000001-0000-4000-8000-000000000001"
    second_uuid = "00000002-0000-4000-8000-000000000002"

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/42"):
            payload = callback_board(42, first_uuid, second_uuid, white=("A", 2000), black=("B", 1900), winner="white", reason="mystery", result_message="A won by checkmate")
        else:
            payload = callback_board(43, second_uuid, first_uuid, white=("C", 1800), black=("D", 1700), winner="black", reason="bughousepartnerlose")
        return httpx.Response(200, json=payload, request=request)

    service = ChessComMatchupService(Settings(), transport=httpx.MockTransport(handler))
    with pytest.raises(MatchExcludedError, match="unknown_terminal_code"):
        asyncio.run(service.normalized_match(42))


def test_guest_list_selects_freshest_per_class_ties_on_plies_and_reuses_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.chesscom_matchups.time.time", lambda: NOW)
    requests: list[str] = []
    callback_payloads: dict[str, dict[str, Any]] = {}
    games_by_player = {
        "alpha": [101, 102],
        "beta": [103, 104],
        "gamma": [105, 106],
    }
    for offset, game_id in enumerate(range(101, 107)):
        primary_uuid = f"{game_id:08x}-0000-4000-8000-{game_id:012x}"
        partner_id = game_id + 1000
        partner_uuid = f"{partner_id:08x}-0000-4000-8000-{partner_id:012x}"
        plies = 12 if game_id == 106 else 30 + offset
        top_rating = 2500 if game_id < 103 else 2200 if game_id < 105 else 1800
        callback_payloads[str(game_id)] = callback_board(
            game_id,
            primary_uuid,
            partner_uuid,
            white=(f"High{game_id}", top_rating),
            black=(f"Low{game_id}", max(1400, top_rating - 200)),
            winner="white",
            reason="checkmated",
            plies=plies,
        )
        callback_payloads[partner_uuid] = callback_board(
            partner_id,
            partner_uuid,
            primary_uuid,
            white=(f"PartnerOpponent{game_id}", max(1400, top_rating - 300)),
            black=(f"Partner{game_id}", max(1400, top_rating - 100)),
            winner="black",
            reason="bughousepartnerlose",
            plies=plies,
        )

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        path = request.url.path
        if path == "/pub/leaderboards":
            payload = {"live_bughouse": [{"username": "Alpha"}, {"username": "Beta"}, {"username": "Gamma"}]}
        elif path.endswith("/games/archives"):
            username = path.split("/")[3]
            if username == "missing":
                return httpx.Response(404, json={"code": 0, "message": "User not found"}, request=request)
            payload = {"archives": [] if username == "nogames" else [f"https://api.chess.com/pub/player/{username}/games/2026/08"]}
        elif path.endswith("/games/2026/08"):
            username = path.split("/")[3]
            if username == "missing":
                return httpx.Response(404, json={"code": 0, "message": "User not found"}, request=request)
            if username == "nogames":
                return httpx.Response(200, json={"games": []}, request=request)
            payload = {"games": [
                {
                    "rules": "bughouse",
                    "url": f"https://www.chess.com/game/live/{game_id}",
                    "end_time": NOW - (30 * 60 if game_id in {101, 102} else 2 * 3600),
                }
                for game_id in games_by_player.get(username, [])
            ]}
        else:
            payload = callback_payloads[path.rsplit("/", 1)[-1]]
        return httpx.Response(200, json=payload, request=request)

    settings = Settings(
        chesscom_players_of_interest="Alpha",
        chesscom_seed_players_1900_2300="Beta",
        chesscom_seed_players_1400_1900="Gamma",
        chesscom_guest_max_archives_per_player=1,
        chesscom_guest_max_matches_examined=10,
    )
    service = ChessComMatchupService(settings, transport=httpx.MockTransport(handler))
    first = asyncio.run(service.guest_matchups())
    request_count = len(requests)
    second = asyncio.run(service.guest_matchups())

    assert len(first["matches"]) == 3
    assert first["examined"] == 6
    assert first["excluded"] == 1
    assert first["exclusion_counts"] == {"under_20_plies": 1}
    assert {"Alpha", "Beta", "Gamma"}.issubset(first["players_sampled"])
    assert first["players_represented"] == ["Alpha", "Beta", "Gamma"]
    assert first["seed_source"] == "players_of_interest"
    assert first["selection_window_hours"] == 3
    assert [match["rating_class"]["label"] for match in first["matches"]] == ["2300+", "1900–2300", "1400–1900"]
    assert [match["game_ids"]["A"] for match in first["matches"]] == [102, 104, 105]
    assert [match["top_rating"] for match in first["matches"]] == [2500, 2200, 1800]
    assert [item["status"] for item in first["classes"]] == ["fresh", "older", "older"]
    assert [item["window_hours"] for item in first["classes"]] == [1, 3, 3]
    assert first["cached"] is False
    assert second["cached"] is True
    assert len(requests) == request_count


def test_guest_endpoint_returns_validated_partial_list_within_cold_budget(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.chesscom_matchups.time.time", lambda: NOW)
    monkeypatch.setattr("backend.chesscom_matchups._GUEST_ASSEMBLY_BUDGET_SECONDS", 0.05)
    callback_payloads: dict[str, dict[str, Any]] = {}
    for game_id in (101, 102):
        primary_uuid = f"{game_id:08x}-0000-4000-8000-{game_id:012x}"
        partner_id = game_id + 1000
        partner_uuid = f"{partner_id:08x}-0000-4000-8000-{partner_id:012x}"
        callback_payloads[str(game_id)] = callback_board(
            game_id,
            primary_uuid,
            partner_uuid,
            white=(f"High{game_id}", 2500),
            black=(f"Low{game_id}", 2100),
            winner="white",
            reason="checkmated",
        )
        callback_payloads[partner_uuid] = callback_board(
            partner_id,
            partner_uuid,
            primary_uuid,
            white=(f"PartnerOpponent{game_id}", 2000),
            black=(f"Partner{game_id}", 2200),
            winner="black",
            reason="bughousepartnerlose",
        )

    async def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/alpha/games/archives"):
            payload = {"archives": ["https://api.chess.com/pub/player/alpha/games/2026/08"]}
        elif path.endswith("/alpha/games/2026/08"):
            payload = {"games": [
                {"rules": "bughouse", "url": f"https://www.chess.com/game/live/{game_id}", "end_time": NOW - 600}
                for game_id in (101, 102)
            ]}
        elif path.endswith("/beta/games/2026/08"):
            await asyncio.sleep(0.2)
            payload = {"games": []}
        elif path.endswith("/games/2026/08"):
            payload = {"games": []}
        elif path == "/pub/leaderboards":
            payload = {"live_bughouse": []}
        else:
            payload = callback_payloads[path.rsplit("/", 1)[-1]]
        return httpx.Response(200, json=payload, request=request)

    service = ChessComMatchupService(
        Settings(
            chesscom_players_of_interest="Alpha,Beta",
            chesscom_seed_players_1900_2300="Beta",
            chesscom_guest_max_archives_per_player=1,
        ),
        transport=httpx.MockTransport(handler),
    )
    monkeypatch.setattr(main_module, "chesscom_matchups", service)
    monkeypatch.setattr(main_module, "games", GameService(tmp_path / "legacy.sqlite"))

    async def request_endpoint() -> tuple[httpx.Response, float]:
        transport = httpx.ASGITransport(app=main_module.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            started = time.perf_counter()
            response = await client.get("/api/chesscom/guest-matchups")
            return response, time.perf_counter() - started

    response, elapsed = asyncio.run(request_endpoint())

    assert elapsed < 0.2
    assert response.status_code == 200
    assert len(response.json()["matches"]) == 3
    assert sum(match.get("placeholder", False) for match in response.json()["matches"]) == 2
    assert response.json()["partial"] is True
    assert response.json()["assembly_budget_exhausted"] is True


def test_configured_players_of_interest_preserve_priority_order() -> None:
    service = ChessComMatchupService(
        Settings(chesscom_players_of_interest="Gamma, Alpha, Beta"),
    )

    assert service._configured_seed_usernames() == ["Gamma", "Alpha", "Beta"]


def test_rating_boundaries_and_floor_exclusion_are_exact(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.chesscom_matchups.time.time", lambda: NOW)
    service, _requests = rating_class_fixture(
        {"topseed": [401], "midseed": [402], "lowseed": [403]},
        {
            401: (2300, NOW - 600, 40),
            402: (1900, NOW - 500, 40),
            403: (1399, NOW - 400, 40),
        },
        chesscom_players_of_interest="TopSeed",
        chesscom_seed_players_1900_2300="MidSeed",
        chesscom_seed_players_1400_1900="LowSeed",
    )

    payload = asyncio.run(service.guest_matchups())

    assert payload["matches"][0]["top_rating"] == 2300
    assert payload["matches"][0]["rating_class"]["label"] == "2300+"
    assert payload["matches"][1]["top_rating"] == 1900
    assert payload["matches"][1]["rating_class"]["label"] == "1900–2300"
    assert payload["matches"][2] == {
        "rating_class": {"label": "1400–1900", "min": 1400, "max": 1900},
        "placeholder": True,
        "reason": "no_game_in_7_days",
    }
    assert payload["exclusion_counts"]["below_floor"] == 1
    assert payload["partial"] is True


def test_each_class_ladder_reaches_seven_days_and_counts_older_games(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.chesscom_matchups.time.time", lambda: NOW)
    service, _requests = rating_class_fixture(
        {"topseed": [], "oldseed": [411, 412]},
        {
            411: (1800, NOW - 6 * 86_400, 40),
            412: (1800, NOW - 8 * 86_400, 40),
        },
        chesscom_players_of_interest="TopSeed",
        chesscom_seed_players_1400_1900="OldSeed",
    )

    payload = asyncio.run(service.guest_matchups())

    assert payload["matches"][2]["game_ids"]["A"] == 411
    assert payload["matches"][2]["finished_seconds_ago"] == 6 * 86_400
    assert payload["classes"][2] == {
        "label": "1400–1900",
        "min": 1400,
        "max": 1900,
        "status": "older",
        "window_hours": 168,
    }
    assert payload["selection_window_hours"] == 168
    assert payload["exclusion_counts"]["outside_7d"] == 1


def test_top_class_ladder_survives_fresh_middle_class_candidate_pressure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.chesscom_matchups.time.time", lambda: NOW)
    middle_ids = list(range(720, 740))
    service, _requests = rating_class_fixture(
        {"topseed": [701], "middleseed": middle_ids},
        {
            701: (2500, NOW - 2 * 3600, 40),
            **{
                game_id: (2200, NOW - 600 - offset, 40)
                for offset, game_id in enumerate(middle_ids)
            },
        },
        chesscom_players_of_interest="TopSeed",
        chesscom_seed_players_1900_2300="MiddleSeed",
        chesscom_guest_max_matches_examined=10,
    )

    payload = asyncio.run(service.guest_matchups())

    assert payload["matches"][0]["game_ids"]["A"] == 701
    assert payload["classes"][0]["window_hours"] == 3
    assert payload["classes"][0]["status"] == "older"
    assert payload["examined_upstream"] <= 10


def test_cached_matches_do_not_consume_the_examination_cap(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.chesscom_matchups.time.time", lambda: NOW)
    service, _requests = rating_class_fixture(
        {"topseed": [741], "middleseed": [742], "lowseed": [743]},
        {
            741: (2500, NOW - 600, 40),
            742: (2200, NOW - 500, 40),
            743: (1800, NOW - 400, 40),
        },
        chesscom_players_of_interest="TopSeed",
        chesscom_seed_players_1900_2300="MiddleSeed",
        chesscom_seed_players_1400_1900="LowSeed",
        chesscom_guest_max_matches_examined=6,
    )
    first = asyncio.run(service.guest_matchups())
    service._guest_cache = None

    second = asyncio.run(service.guest_matchups())

    assert first["examined_upstream"] == 3
    assert second["examined"] == 3
    assert second["examined_upstream"] == 0
    assert second["matches"] == first["matches"]


def test_assemble_enforces_per_class_share_and_rolls_unused_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.chesscom_matchups.time.time", lambda: NOW)

    def build(
        games_by_player: dict[str, list[int]],
        specs: dict[int, tuple[int, int, int]],
    ) -> tuple[dict[str, Any], list[str]]:
        service, requests = rating_class_fixture(
            games_by_player,
            specs,
            chesscom_players_of_interest="TopSeed",
            chesscom_seed_players_1900_2300="MiddleSeed",
            chesscom_seed_players_1400_1900="LowSeed",
            chesscom_guest_max_matches_examined=6,
        )
        return asyncio.run(service.guest_matchups()), requests

    balanced_groups = ([801, 802, 803], [811, 812, 813], [821, 822, 823])
    balanced, balanced_requests = build(
        {"topseed": balanced_groups[0], "middleseed": balanced_groups[1], "lowseed": balanced_groups[2]},
        {
            game_id: (rating, NOW - 600 - offset, 40)
            for group, rating in zip(balanced_groups, (2500, 2200, 1800), strict=True)
            for offset, game_id in enumerate(group)
        },
    )
    balanced_counts = [
        sum(request.endswith(f"/{game_id}") for request in balanced_requests for game_id in group)
        for group in balanced_groups
    ]

    rollover_groups = ([831], [841, 842, 843], [851, 852])
    rollover, rollover_requests = build(
        {"topseed": rollover_groups[0], "middleseed": rollover_groups[1], "lowseed": rollover_groups[2]},
        {
            game_id: (rating, NOW - 600 - offset, 40)
            for group, rating in zip(rollover_groups, (2500, 2200, 1800), strict=True)
            for offset, game_id in enumerate(group)
        },
    )
    rollover_counts = [
        sum(request.endswith(f"/{game_id}") for request in rollover_requests for game_id in group)
        for group in rollover_groups
    ]

    assert balanced["examined_upstream"] == 6
    assert balanced_counts == [2, 2, 2]
    assert rollover["examined_upstream"] == 6
    assert rollover_counts == [1, 3, 2]


def test_background_top_up_stops_archive_collection_at_the_upstream_cap(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.chesscom_matchups.time.time", lambda: NOW)
    service, requests = rating_class_fixture(
        {
            "topseed": [861],
            "middleseed": [862],
            "lowseed": [863],
            "extratop": [864],
            "extramiddle": [865],
        },
        {
            861: (2500, NOW - 600, 40),
            862: (2200, NOW - 500, 40),
            863: (1800, NOW - 400, 40),
            864: (2500, NOW - 300, 40),
            865: (2200, NOW - 200, 40),
        },
        chesscom_players_of_interest="TopSeed",
        chesscom_seed_players_1900_2300="MiddleSeed",
        chesscom_seed_players_1400_1900="LowSeed",
        chesscom_guest_max_matches_examined=5,
    )
    service.settings.chesscom_guest_max_matches_examined = 3
    service._record_roster_seat("ExtraTop", 2500, NOW - 1)
    service._record_roster_seat("ExtraMiddle", 2200, NOW - 1)
    service._player_last_active.update({"topseed": NOW, "middleseed": NOW, "lowseed": NOW})

    payload, _pool = asyncio.run(service._build_guest_matchups(set(), background=True))

    assert payload["examined_upstream"] == 3
    assert not any("/player/extratop/games/" in request for request in requests)
    assert not any("/player/extramiddle/games/" in request for request in requests)


@pytest.mark.parametrize(
    ("classes", "floor", "message"),
    [
        ("1900-2300,2300+,1400-1900", 1400, "open-ended highest"),
        ("2300+,1800-2200,1400-1800", 1400, "high-to-low and contiguous"),
        ("2300+,1900-2300,1400-1900", 1300, "must start"),
    ],
)
def test_invalid_rating_class_config_is_rejected(classes: str, floor: int, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        Settings(chesscom_guest_rating_classes=classes, chesscom_guest_min_top_rating=floor)


def test_roster_records_seats_by_own_class_and_prunes_by_age_and_cap() -> None:
    service = ChessComMatchupService(Settings(chesscom_guest_roster_max_per_class=1))
    service._record_match_roster({
        "end_time": NOW,
        "seats": {
            "A-white": {"name": "Top", "rating": 2400},
            "A-black": {"name": "Middle", "rating": 2100},
            "B-white": {"name": "Lower", "rating": 1700},
            "B-black": {"name": "Below", "rating": 1399},
        },
    })
    service._record_roster_seat("OlderTop", 2500, NOW - 1)
    service._record_roster_seat("ExpiredMiddle", 2000, NOW - 8 * 86_400)
    service._prune_roster(NOW)

    assert list(service._roster["2300+"]) == ["top"]
    assert list(service._roster["1900–2300"]) == ["middle"]
    assert list(service._roster["1400–1900"]) == ["lower"]
    assert "below" not in {name for members in service._roster.values() for name in members}


def test_version_one_cache_still_loads_without_a_roster(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.chesscom_matchups.time.time", lambda: NOW)
    path = tmp_path / "v1.json"
    path.write_text(json.dumps({
        "version": 1,
        "saved_at": NOW,
        "payload": {"matches": []},
        "pool": [],
        "player_last_active": {"alpha": NOW},
    }), encoding="utf-8")
    service = ChessComMatchupService(Settings())
    service.cache_path = path

    assert service._load_persisted() is True
    assert service._player_last_active == {"alpha": NOW}
    assert all(not members for members in service._roster.values())


def test_default_guest_list_ttl_drives_refresh_loop(monkeypatch: pytest.MonkeyPatch) -> None:
    service = ChessComMatchupService(Settings())
    service._store_entry({"matches": []}, [])
    sleeps: list[float] = []

    async def stop_after_sleep(delay: float) -> None:
        sleeps.append(delay)
        raise asyncio.CancelledError

    monkeypatch.setattr("backend.chesscom_matchups.asyncio.sleep", stop_after_sleep)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(service._refresh_loop())

    assert service.settings.chesscom_guest_list_ttl_seconds == 300
    assert sleeps[0] == pytest.approx(210, abs=0.1)


def test_guest_refresh_rotates_from_pool_without_upstream_requests(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.chesscom_matchups.time.time", lambda: NOW)
    players = {
        "alpha": [201, 202],
        "beta": [203, 204],
        "gamma": [205, 206],
    }
    callbacks: dict[str, dict[str, Any]] = {}
    requests: list[str] = []
    for game_id in range(201, 207):
        primary_uuid = f"{game_id:08x}-0000-4000-8000-{game_id:012x}"
        partner_id = game_id + 1000
        partner_uuid = f"{partner_id:08x}-0000-4000-8000-{partner_id:012x}"
        top_rating = 2500 if game_id < 203 else 2200 if game_id < 205 else 1800
        callbacks[str(game_id)] = callback_board(
            game_id,
            primary_uuid,
            partner_uuid,
            white=(f"High{game_id}", top_rating),
            black=(f"Low{game_id}", max(1400, top_rating - 200)),
            winner="white",
            reason="checkmated",
        )
        callbacks[partner_uuid] = callback_board(
            partner_id,
            partner_uuid,
            primary_uuid,
            white=(f"PartnerOpponent{game_id}", max(1400, top_rating - 300)),
            black=(f"Partner{game_id}", max(1400, top_rating - 100)),
            winner="black",
            reason="bughousepartnerlose",
        )

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        path = request.url.path
        if path.endswith("/games/archives"):
            username = path.split("/")[3]
            payload = {"archives": [f"https://api.chess.com/pub/player/{username}/games/2026/08"]}
        elif path.endswith("/games/2026/08"):
            username = path.split("/")[3]
            payload = {"games": [
                {
                    "rules": "bughouse",
                    "url": f"https://www.chess.com/game/live/{game_id}",
                    "end_time": NOW - 10 * 60,
                }
                for game_id in players.get(username, [])
            ]}
        elif path == "/pub/leaderboards":
            payload = {"live_bughouse": [{"username": name} for name in players]}
        else:
            payload = callbacks[path.rsplit("/", 1)[-1]]
        return httpx.Response(200, json=payload, request=request)

    service = ChessComMatchupService(
        Settings(
            chesscom_players_of_interest="Alpha",
            chesscom_seed_players_1900_2300="Beta",
            chesscom_seed_players_1400_1900="Gamma",
            chesscom_guest_max_archives_per_player=1,
            chesscom_guest_max_matches_examined=20,
        ),
        transport=httpx.MockTransport(handler),
    )
    first = asyncio.run(service.guest_matchups())
    first_request_count = len(requests)
    current_ids = {
        game_id
        for match in first["matches"]
        for game_id in match["game_ids"].values()
    }
    refreshed = asyncio.run(service.guest_matchups(refresh=True, exclude_game_ids=current_ids))
    refreshed_ids = {
        game_id
        for match in refreshed["matches"]
        for game_id in match["game_ids"].values()
    }

    assert len(requests) == first_request_count
    assert current_ids.isdisjoint(refreshed_ids)
    assert len(refreshed["matches"]) == 3
    assert refreshed["cached"] is True
    assert refreshed["regenerated_from_pool"] is True
    assert refreshed["selection_window_hours"] == 1


def test_guest_refresh_marks_rotated_classes_and_retained_game_ids(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.chesscom_matchups.time.time", lambda: NOW)
    service, _requests = rating_class_fixture(
        {"topseed": [501, 502], "midseed": [503, 504], "lowseed": [505]},
        {
            501: (2500, NOW - 600, 40),
            502: (2500, NOW - 500, 40),
            503: (2200, NOW - 600, 40),
            504: (2200, NOW - 500, 40),
            505: (1800, NOW - 500, 40),
        },
        chesscom_players_of_interest="TopSeed",
        chesscom_seed_players_1900_2300="MidSeed",
        chesscom_seed_players_1400_1900="LowSeed",
    )
    first = asyncio.run(service.guest_matchups())
    third_game_ids = first["matches"][2]["game_ids"]

    payload = asyncio.run(service.guest_matchups(refresh=True))

    assert [rating_class["rotated"] for rating_class in payload["classes"]] == [True, True, False]
    assert payload["matches"][2]["game_ids"] == third_game_ids


def test_kill_switch_disables_match_and_guest_routes_before_network_access() -> None:
    service = ChessComMatchupService(Settings(chesscom_match_proxy_enabled=False))
    with pytest.raises(MatchProxyDisabledError):
        asyncio.run(service.normalized_match(42))
    with pytest.raises(MatchProxyDisabledError):
        asyncio.run(service.guest_matchups())


def _five_player_fixture(requests: list[str]):
    players = {
        "alpha": [301, 302],
        "beta": [303, 304],
        "gamma": [305, 306],
        "delta": [307, 308],
        "epsilon": [309, 310],
    }
    callbacks: dict[str, dict[str, Any]] = {}
    for game_id in range(301, 311):
        primary_uuid = f"{game_id:08x}-0000-4000-8000-{game_id:012x}"
        partner_id = game_id + 1000
        partner_uuid = f"{partner_id:08x}-0000-4000-8000-{partner_id:012x}"
        top_rating = (
            2500 if game_id in {301, 302, 307, 310}
            else 2200 if game_id in {303, 304, 308}
            else 1800
        )
        callbacks[str(game_id)] = callback_board(
            game_id, primary_uuid, partner_uuid,
            white=(f"High{game_id}", top_rating), black=(f"Low{game_id}", max(1400, top_rating - 200)),
            winner="white", reason="checkmated",
        )
        callbacks[partner_uuid] = callback_board(
            partner_id, partner_uuid, primary_uuid,
            white=(f"PartnerOpponent{game_id}", max(1400, top_rating - 300)),
            black=(f"Partner{game_id}", max(1400, top_rating - 100)),
            winner="black", reason="bughousepartnerlose",
        )

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        path = request.url.path
        if path.endswith("/games/archives"):
            username = path.split("/")[3]
            payload = {"archives": [
                f"https://api.chess.com/pub/player/{username}/games/2026/07",
                f"https://api.chess.com/pub/player/{username}/games/2026/08",
            ]}
        elif path.endswith("/games/2026/08"):
            username = path.split("/")[3]
            payload = {"games": [
                {"rules": "bughouse", "url": f"https://www.chess.com/game/live/{game_id}", "end_time": NOW - 10 * 60}
                for game_id in players.get(username, [])
            ]}
        elif path.endswith("/games/2026/07"):
            raise AssertionError("July archive cannot hold games from the last seven days and must not be fetched")
        elif path == "/pub/leaderboards":
            payload = {"live_bughouse": [{"username": name} for name in players]}
        else:
            payload = callbacks[path.rsplit("/", 1)[-1]]
        return httpx.Response(200, json=payload, request=request)

    settings = Settings(
        chesscom_players_of_interest="Alpha, Beta, Gamma, Delta, Epsilon",
        chesscom_seed_players_1900_2300="Beta, Delta",
        chesscom_seed_players_1400_1900="Gamma, Epsilon",
        chesscom_guest_max_archives_per_player=2,
        chesscom_guest_max_matches_examined=20,
        chesscom_guest_pool_target=10,
    )
    return ChessComMatchupService(settings, transport=httpx.MockTransport(handler))


def test_background_build_fills_a_pool_so_regenerate_needs_no_upstream_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.chesscom_matchups.time.time", lambda: NOW)
    requests: list[str] = []
    service = _five_player_fixture(requests)

    async def scenario() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], int]:
        await service._background_rebuild()
        first = await service.guest_matchups()
        after_build = len(requests)
        current_ids = {game_id for match in first["matches"] for game_id in match["game_ids"].values()}
        rotated = await service.guest_matchups(refresh=True, exclude_game_ids=current_ids)
        rotated_ids = {game_id for match in rotated["matches"] for game_id in match["game_ids"].values()}
        after_rotate = len(requests)
        exhausted = await service.guest_matchups(refresh=True, exclude_game_ids=current_ids | rotated_ids)
        return first, rotated, exhausted, after_build, after_rotate

    first, rotated, exhausted, after_build, after_rotate = asyncio.run(scenario())

    assert first["cached"] is True
    assert first["pool_size"] == 10
    assert first["upstream_requests"] >= 5 + 20
    assert not any(url.endswith("/games/archives") for url in requests)
    assert not any(url.endswith("/games/2026/07") for url in requests)
    assert len(rotated["matches"]) == 3
    assert rotated["regenerated_from_pool"] is True
    assert rotated["cached"] is True
    assert rotated["upstream_requests"] == 0
    assert after_rotate == after_build
    assert exhausted["regenerated_from_pool"] is True
    assert exhausted["cached"] is True
    assert len(exhausted["matches"]) == 3
    assert len(requests) == after_rotate


def test_expired_list_is_served_stale_while_a_background_rebuild_runs(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.chesscom_matchups.time.time", lambda: NOW)
    requests: list[str] = []
    service = _five_player_fixture(requests)

    async def scenario() -> tuple[dict[str, Any], int, dict[str, Any]]:
        await service.guest_matchups()
        service._guest_cache.stored_at -= service.settings.chesscom_guest_list_ttl_seconds + 1
        before = len(requests)
        stale = await service.guest_matchups()
        assert len(requests) == before  # returned without waiting on Chess.com
        assert service._refresh_task is not None
        await service._refresh_task
        fresh = await service.guest_matchups()
        return stale, before, fresh

    stale, before, fresh = asyncio.run(scenario())
    assert stale["cached"] is True and stale["stale"] is True
    assert len(stale["matches"]) == 3
    assert fresh["cached"] is True and "stale" not in fresh
    assert len(requests) > before


def test_upstream_client_is_shared_across_requests_in_one_loop() -> None:
    requests: list[str] = []
    service = _five_player_fixture(requests)

    async def scenario() -> tuple[int, int]:
        await service._get_json("https://api.chess.com/pub/leaderboards")
        first = id(service._client)
        await service._get_json("https://api.chess.com/pub/leaderboards")
        second = id(service._client)
        await service.aclose()
        return first, second

    first, second = asyncio.run(scenario())
    assert first == second
    assert service._client is None


def test_persisted_list_survives_a_restart(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    requests: list[str] = []
    service = _five_player_fixture(requests)
    service.cache_path = tmp_path / "guest_matchups_cache.json"
    monkeypatch.setattr("backend.chesscom_matchups.time.time", lambda: NOW)
    asyncio.run(service._background_rebuild())
    assert service.cache_path.is_file()
    persisted = json.loads(service.cache_path.read_text(encoding="utf-8"))
    assert persisted["version"] == 2
    assert persisted["roster"]

    restarted: list[str] = []
    fresh_process = _five_player_fixture(restarted)
    fresh_process.cache_path = service.cache_path
    assert fresh_process._load_persisted() is True
    served = asyncio.run(fresh_process.guest_matchups())
    assert served["cached"] is True
    assert len(served["matches"]) == 3
    assert len(fresh_process._guest_cache.pool) == 10
    assert any(fresh_process._roster.values())
    assert restarted == []


def test_app_lifespan_skips_warm_up_when_disabled_and_closes_the_client(monkeypatch: pytest.MonkeyPatch) -> None:
    from fastapi.testclient import TestClient

    calls: list[str] = []

    class FakeMatchups:
        cache_path = None

        def start_background_refresh(self) -> None:
            calls.append("start")

        async def aclose(self) -> None:
            calls.append("close")

    monkeypatch.setattr(main_module, "chesscom_matchups", FakeMatchups())
    monkeypatch.setattr(main_module.settings, "chesscom_guest_warm_on_startup", False)
    with TestClient(main_module.app):
        pass
    assert calls == ["close"]

    calls.clear()
    monkeypatch.setattr(main_module.settings, "chesscom_guest_warm_on_startup", True)
    with TestClient(main_module.app):
        pass
    assert calls == ["start", "close"]
