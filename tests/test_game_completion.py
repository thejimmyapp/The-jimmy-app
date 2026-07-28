from __future__ import annotations

from pathlib import Path

from backend.services import GameService
from thejimmyapp.game_completion import (
    is_completed_chesscom_game,
    is_completed_pgn,
    is_completed_stored_game,
    player_results,
)


def test_pgn_requires_a_terminal_result() -> None:
    assert is_completed_pgn('[Result "1-0"]\n\n1. e4 1-0')
    assert is_completed_pgn('[Variant "Bughouse"]\n\n1. e4 e5 1/2-1/2')
    assert not is_completed_pgn('[Result "*"]\n\n1. e4 *')
    assert not is_completed_pgn('[Variant "Bughouse"]\n\n1. e4')


def test_chesscom_game_requires_finished_archive_signals() -> None:
    completed = {
        "end_time": 1_750_000_000,
        "white": {"result": "win"},
        "black": {"result": "checkmated"},
        "pgn": '[Result "1-0"]\n\n1. e4 1-0',
    }
    active = {
        "white": {"result": ""},
        "black": {"result": ""},
        "pgn": '[Result "*"]\n\n1. e4 *',
    }
    assert is_completed_chesscom_game(completed)
    assert not is_completed_chesscom_game(active)


def test_stored_game_and_service_hide_incomplete_records(tmp_path: Path) -> None:
    service = GameService(tmp_path / "games.db")
    complete = {
        "url": "manual://complete",
        "pgn": '[Result "1-0"]\n\n1. e4 1-0',
        "rules": "bughouse",
        "white": {"username": "FixtureUser", "result": "win"},
        "black": {"username": "Opponent", "result": "checkmated"},
    }
    incomplete = {
        "url": "manual://incomplete",
        "pgn": '[Result "*"]\n\n1. e4 *',
        "rules": "bughouse",
        "white": {"username": "FixtureUser", "result": ""},
        "black": {"username": "Opponent", "result": ""},
    }
    service.db.upsert_game("FixtureUser", complete)
    service.db.upsert_game("FixtureUser", incomplete)
    complete_id = int(service.db.connect().execute("SELECT id FROM games WHERE url = 'manual://complete'").fetchone()[0])
    incomplete_record = service.db.connect().execute("SELECT * FROM games WHERE url = 'manual://incomplete'").fetchone()
    incomplete_id = int(incomplete_record["id"])

    assert player_results("1-0") == ("win", "checkmated")
    assert is_completed_stored_game(dict(service.db.get_game(complete_id) or {}))
    assert not is_completed_stored_game(dict(incomplete_record))
    assert service.is_completed_game(complete_id)
    assert not service.is_completed_game(incomplete_id)
    assert [row["id"] for row in service.list_games("FixtureUser")] == [complete_id]
    assert service.get_game_payload(incomplete_id) is None
