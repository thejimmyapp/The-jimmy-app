from pathlib import Path

from backend.services import GameService


BOARD_A_PGN = """\
[Variant "Bughouse"]
[White "FixtureUser"]
[Black "Opponent"]
[TimeControl "180"]
[Result "1-0"]

1. e4 {[%clk 0:02:59]} e5 {[%clk 0:02:58]} 1-0
"""

BOARD_B_PGN = """\
[Variant "Bughouse"]
[White "DiagonalOpponent"]
[Black "Partner"]
[TimeControl "180"]
[Result "0-1"]

1. d4 {[%clk 0:02:57]} d5 {[%clk 0:02:56]} 0-1
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
        "pgn": '[Variant "Bughouse"]\n[Result "1-0"]\n\n1. e4 e5 1-0',
        "bughousePartnerPgn": '[Variant "Bughouse"]\n[Result "0-1"]\n\n1. d4 d5 0-1',
        "rules": "bughouse",
        "white": {"username": "FixtureUser", "result": "win"},
        "black": {"username": "Opponent", "result": "checkmated"},
    }

    service.db.upsert_game("FixtureUser", raw_game)
    game_id = int(service.list_games("FixtureUser")[0]["id"])
    payload = service.get_game_payload(game_id)

    assert payload is not None
    assert payload["second_board_available"] is True
    assert payload["limitations"] == [
        "Cross-board move order is approximate because complete clock timestamps are unavailable."
    ]


def test_review_payload_surfaces_one_current_evidence_backed_lesson(tmp_path: Path) -> None:
    service = GameService(tmp_path / "games.db")
    raw_game = {
        "url": "manual://lesson",
        "pgn": BOARD_A_PGN,
        "bughousePartnerPgn": BOARD_B_PGN,
        "rules": "bughouse",
        "white": {"username": "FixtureUser", "result": "win"},
        "black": {"username": "Opponent", "result": "resigned"},
    }
    service.db.upsert_game("FixtureUser", raw_game)
    game_id = int(service.list_games("FixtureUser")[0]["id"])
    service.db.replace_game_mistakes(
        game_id,
        14,
        [
            {
                "username": "fixtureuser",
                "ply": 1,
                "move": "e4",
                "side": "white",
                "reason": "capture",
                "category": "ignored partner danger",
                "tactical_motif": "removal of defender",
                "severity": "mistake",
                "estimated_loss_cp": 184,
                "bestmove": "N@h6",
                "score_before": "+1.20",
                "score_after": "-0.64",
                "depth": 14,
                "confidence": "high",
                "note": "Stored deterministic engine evidence.",
                "partner_danger": "Your partner was facing a mate threat on the synced board.",
            }
        ],
    )

    payload = service.get_game_payload(game_id)

    assert payload is not None
    assert payload["lesson"] == {
        "id": str(service.db.get_primary_mistake_for_game(game_id)["id"]),
        "board": "A",
        "local_ply": 1,
        "global_ply": next(
            frame["global_ply"]
            for frame in payload["timeline"]
            if frame["board"] == "A" and frame["local_ply"] == 1
        ),
        "played_move": "e4",
        "best_move": "N@h6",
        "severity": "mistake",
        "estimated_loss_cp": 184,
        "category": "ignored partner danger",
        "pattern": "removal of defender",
        "confidence": "high",
        "depth": 14,
        "partner_context": "Your partner was facing a mate threat on the synced board.",
    }


def test_review_payload_does_not_present_low_confidence_analysis_as_a_lesson(tmp_path: Path) -> None:
    service = GameService(tmp_path / "games.db")
    raw_game = {
        "url": "manual://low-confidence",
        "pgn": BOARD_A_PGN,
        "bughousePartnerPgn": BOARD_B_PGN,
        "rules": "bughouse",
        "white": {"username": "FixtureUser", "result": "win"},
        "black": {"username": "Opponent", "result": "resigned"},
    }
    service.db.upsert_game("FixtureUser", raw_game)
    game_id = int(service.list_games("FixtureUser")[0]["id"])
    service.db.replace_game_mistakes(
        game_id,
        10,
        [
            {
                "username": "fixtureuser",
                "ply": 1,
                "move": "e4",
                "side": "white",
                "reason": "incomplete pockets",
                "category": "tactical miss",
                "severity": "mistake",
                "estimated_loss_cp": 220,
                "bestmove": "N@h6",
                "score_before": "+1.10",
                "score_after": "-1.10",
                "depth": 10,
                "confidence": "low",
                "note": "Pocket data is incomplete.",
            }
        ],
    )

    payload = service.get_game_payload(game_id)

    assert payload is not None
    assert payload["lesson"] is None
