from pathlib import Path

from backend.services import GameService


BOARD_A_PGN = """\
[Variant "Bughouse"]
[White "FixtureUser"]
[Black "Opponent"]
[TimeControl "180"]

1. e4 {[%clk 0:02:59]} e5 {[%clk 0:02:58]} *
"""

BOARD_B_PGN = """\
[Variant "Bughouse"]
[White "DiagonalOpponent"]
[Black "Partner"]
[TimeControl "180"]

1. d4 {[%clk 0:02:57]} d5 {[%clk 0:02:56]} *
"""


def test_manual_two_board_pgn_becomes_a_synchronized_replay(tmp_path: Path) -> None:
    service = GameService(tmp_path / "games.db")
    raw_game = {
        "url": "manual://fixture",
        "uuid": "fixture",
        "pgn": BOARD_A_PGN,
        "bughousePartnerPgn": BOARD_B_PGN,
        "bughousePlayer1Name": "FixtureUser",
        "bughousePlayer2Name": "Opponent",
        "bughousePartnerPlayer1Name": "DiagonalOpponent",
        "bughousePartnerPlayer2Name": "Partner",
        "rules": "bughouse",
        "white": {"username": "FixtureUser", "result": "win"},
        "black": {"username": "Opponent", "result": "resigned"},
    }

    assert service.db.upsert_game("FixtureUser", raw_game) is True
    listed = service.list_games("FixtureUser")[0]
    assert listed["partner"] == "Partner"
    game_id = int(listed["id"])
    payload = service.get_game_payload(game_id)

    assert payload is not None
    assert payload["second_board_available"] is True
    assert len(payload["moves_a"]) == 2
    assert len(payload["moves_b"]) == 2
    assert len(payload["timeline"]) == 5
    assert payload["players"]["board_b_white"] == "DiagonalOpponent"
    assert payload["players"]["board_b_black"] == "Partner"
    assert payload["limitations"] == []
    assert payload["timeline"][-1]["board_a"]["white_clock"] == "2:59"
    assert payload["timeline"][-1]["board_b"]["black_clock"] == "2:56"


def test_manual_two_board_pgn_reports_approximate_order_without_clocks(tmp_path: Path) -> None:
    service = GameService(tmp_path / "games.db")
    raw_game = {
        "url": "manual://no-clocks",
        "pgn": '[Variant "Bughouse"]\n\n1. e4 e5 *',
        "bughousePartnerPgn": '[Variant "Bughouse"]\n\n1. d4 d5 *',
        "rules": "bughouse",
    }

    service.db.upsert_game("FixtureUser", raw_game)
    game_id = int(service.list_games("FixtureUser")[0]["id"])
    payload = service.get_game_payload(game_id)

    assert payload is not None
    assert payload["second_board_available"] is True
    assert payload["limitations"] == [
        "Cross-board move order is approximate because complete clock timestamps are unavailable."
    ]
