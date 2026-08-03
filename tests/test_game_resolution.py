from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi.testclient import TestClient
import httpx
import pytest

import backend.main as main_module
from backend.chesscom import ChessComService
from backend.config import Settings
from backend.game_resolution import canonical_chesscom_game_urls, normalize_chesscom_game_url
from backend.services import GameService


BOARD_A_PGN = """\
[Variant "Bughouse"]
[White "FixtureUser"]
[Black "Opponent"]
[Result "1-0"]

1. e4 e5 1-0
"""

BOARD_B_PGN = """\
[Variant "Bughouse"]
[White "DiagonalOpponent"]
[Black "Partner"]
[Result "0-1"]

1. d4 d5 0-1
"""


def completed_game(game_id: str, *, paired: bool = False) -> dict[str, object]:
    game: dict[str, object] = {
        "url": f"https://www.chess.com/game/live/{game_id}",
        "pgn": BOARD_A_PGN,
        "rules": "bughouse",
        "end_time": 1_786_000_000,
        "white": {"username": "FixtureUser", "result": "win"},
        "black": {"username": "Opponent", "result": "resigned"},
    }
    if paired:
        game["bughousePartnerPgn"] = BOARD_B_PGN
    return game


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("https://www.chess.com/game/live/123456789", "123456789"),
        ("https://www.chess.com/live/game/987654321", "987654321"),
        ("https://www.chess.com/game/live/123456789?move=0", "123456789"),
    ],
)
def test_supported_chesscom_urls_normalize_to_the_exact_id(value: str, expected: str) -> None:
    assert normalize_chesscom_game_url(value) == expected


@pytest.mark.parametrize(
    "value",
    [
        "http://www.chess.com/game/live/123",
        "https://chess.com/game/live/123",
        "https://attacker.example/game/live/123",
        "https://www.chess.com/games/live/123",
        "https://www.chess.com/game/live/not-a-number",
        "https://www.chess.com@127.0.0.1/game/live/123",
        "https://www.chess.com:443/game/live/123",
        "https://www.chess.com/game/live/123#fragment",
        "file:///etc/passwd",
        "http://169.254.169.254/latest/meta-data",
    ],
)
def test_unsupported_and_ssrf_shaped_urls_are_rejected(value: str) -> None:
    with pytest.raises(ValueError):
        normalize_chesscom_game_url(value)


def test_stored_resolution_returns_only_the_exact_completed_game(tmp_path: Path) -> None:
    service = GameService(tmp_path / "games.db")
    service.db.upsert_game("FixtureUser", completed_game("111"))
    service.db.upsert_game("FixtureUser", completed_game("222"))

    payload = service.resolve_stored_game(canonical_chesscom_game_urls("111"), "FixtureUser")

    assert payload is not None
    assert payload["game"]["url"] == "https://www.chess.com/game/live/111"


def test_duplicate_stored_records_prefer_a_completed_paired_record_without_combining(tmp_path: Path) -> None:
    service = GameService(tmp_path / "games.db")
    service.db.upsert_game("FirstUser", completed_game("333"))
    service.db.upsert_game("SecondUser", completed_game("333", paired=True))

    payload = service.resolve_stored_game(canonical_chesscom_game_urls("333"), "FirstUser")

    assert payload is not None
    assert payload["game"]["username"] == "seconduser"
    assert payload["second_board_available"] is True


def install_archive_transport(monkeypatch: pytest.MonkeyPatch, handler) -> None:
    original_client = httpx.AsyncClient
    transport = httpx.MockTransport(handler)

    def client_factory(*_args, **_kwargs):
        return original_client(transport=transport)

    async def no_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr("backend.chesscom.httpx.AsyncClient", client_factory)
    monkeypatch.setattr("backend.chesscom.asyncio.sleep", no_sleep)


def test_official_archive_search_returns_only_the_exact_completed_bughouse_game(monkeypatch: pytest.MonkeyPatch) -> None:
    requested_urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requested_urls.append(str(request.url))
        if request.url.path.endswith("/games/archives"):
            return httpx.Response(
                200,
                json={"archives": ["https://api.chess.com/pub/player/fixtureuser/games/2026/07"]},
                request=request,
            )
        return httpx.Response(
            200,
            json={"games": [completed_game("444"), completed_game("555")]},
            request=request,
        )

    install_archive_transport(monkeypatch, handler)
    service = ChessComService(Settings(chesscom_max_archives=2))

    found = asyncio.run(service.find_exact_game("FixtureUser", "555"))
    missing = asyncio.run(service.find_exact_game("FixtureUser", "999"))

    assert found is not None and found["url"].endswith("/555")
    assert missing is None
    assert all(url.startswith("https://api.chess.com/") for url in requested_urls)


@pytest.mark.parametrize(
    ("status_code", "exception_type", "message"),
    [
        (404, ValueError, "profile not found"),
        (429, RuntimeError, "rate limit reached"),
    ],
)
def test_official_archive_404_and_429_are_explicit(
    monkeypatch: pytest.MonkeyPatch,
    status_code: int,
    exception_type: type[Exception],
    message: str,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, headers={"Retry-After": "30"}, request=request)

    install_archive_transport(monkeypatch, handler)
    service = ChessComService(Settings())

    with pytest.raises(exception_type, match=message):
        asyncio.run(service.find_exact_game("FixtureUser", "123"))


def test_resolve_endpoint_has_structured_not_found_and_never_opens_another_game(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    service = GameService(tmp_path / "games.db")
    service.db.upsert_game("FixtureUser", completed_game("777"))
    monkeypatch.setattr(main_module, "games", service)

    with TestClient(main_module.app) as client:
        response = client.post(
            "/api/games/resolve",
            json={"url": "https://www.chess.com/game/live/778"},
        )

    assert response.status_code == 404
    assert response.json()["detail"] == {
        "code": "game_not_found",
        "message": "That exact completed Bughouse game was not found in the available data.",
        "external_game_id": "778",
    }


def test_resolve_endpoint_opens_exact_stored_game_and_import_returns_its_id(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    service = GameService(tmp_path / "games.db")
    service.db.upsert_game("FixtureUser", completed_game("888", paired=True))
    monkeypatch.setattr(main_module, "games", service)

    with TestClient(main_module.app) as client:
        resolved = client.post(
            "/api/games/resolve",
            json={"url": "https://www.chess.com/live/game/888?move=0"},
        )
        imported = client.post(
            "/api/games/import-pgn",
            json={"username": "FixtureUser", "pgn": BOARD_A_PGN, "second_board_pgn": BOARD_B_PGN},
        )
        opened = client.get(f"/api/games/{imported.json()['game_id']}")

    assert resolved.status_code == 200
    assert resolved.json()["external_game_id"] == "888"
    assert resolved.json()["game"]["second_board_available"] is True
    assert imported.status_code == 200
    assert isinstance(imported.json()["game_id"], int)
    assert opened.status_code == 200
    assert opened.json()["second_board_available"] is True
