from __future__ import annotations

from backend.coach import prepare_coach_context
from backend.coupled_analysis import analyze_coupled_position
from backend.schemas import CoachPrepareRequest
from pydantic import ValidationError
import pytest


class FakeGames:
    def get_game_payload(self, game_id: int) -> dict[str, object] | None:
        if game_id != 42:
            return None
        board_a = _position("4k3/8/8/8/8/8/8/4K3[N] w - - 0 1", "White", "N", "-")
        board_b = _position("4k3/8/8/8/8/8/8/4K3[p] b - - 0 1", "Black", "-", "p")
        return {
            "game": {"username": "Jimmy", "user_color": "white"},
            "players": {
                "board_a_white": "Jimmy",
                "board_a_black": "Opponent",
                "board_b_white": "Diagonal",
                "board_b_black": "Partner",
            },
            "timeline": [
                {"global_ply": 1, "board": "A", "local_ply": 1, "move": "e4", "board_a": board_a, "board_b": board_b},
                {"global_ply": 2, "board": "B", "local_ply": 1, "move": "d5", "board_a": board_a, "board_b": board_b},
            ],
            "limitations": [],
        }

    def snapshot(self, game_id: int, global_ply: int) -> dict[str, object] | None:
        payload = self.get_game_payload(game_id)
        if not payload:
            return None
        frame = payload["timeline"][min(global_ply, 1)]
        return {"global_ply": global_ply, "board_a": frame["board_a"], "board_b": frame["board_b"]}


def _position(fen: str, side: str, white_pocket: str, black_pocket: str) -> dict[str, object]:
    return {
        "variant_fen": fen,
        "side_to_move": side,
        "white_pocket": white_pocket,
        "black_pocket": black_pocket,
        "white_clock": "0:24",
        "black_clock": "0:19",
        "from_square": None,
        "to_square": None,
    }


def test_coach_prompt_couples_both_boards_without_shared_api_key() -> None:
    request = CoachPrepareRequest.model_validate({
        "game_id": 42,
        "global_ply": 2,
        "question": "What should our team play next?",
        "annotations": [{"board": "A", "type": "arrow", "from": "e2", "to": "e4", "color": "cyan"}],
    })

    result = prepare_coach_context(
        request,
        FakeGames(),
        [{"board": "A", "bestmove": "N@f7", "score_cp": 180, "depth": 10}],
    )

    assert result["mode"] == "validated_context"
    assert result["board_a"]["best_move"] == "N@f7"
    assert result["board_b"]["available"] is True
    assert "captured piece transfers" in result["prompt"]
    assert "N@f7" in result["prompt"]
    assert '"board": "B"' in result["prompt"]
    assert "No external AI API key" in result["privacy"]
    assert result["context"]["coupled_analysis"]["source_of_truth"].startswith("deterministic")
    assert result["facts"]["boards"]["B"]["side_to_move"] == "Black"


def test_coach_request_rejects_client_board_and_engine_truth() -> None:
    with pytest.raises(ValidationError):
        CoachPrepareRequest.model_validate({
            "game_id": 42,
            "global_ply": 2,
            "question": "What should our team play next?",
            "board_a": {"variant_fen": "client-controlled"},
            "engine_suggestions": [{"board": "A", "bestmove": "g1f3"}],
        })


def test_coupled_analyzer_sends_capture_to_partner_instead_of_local_pocket() -> None:
    context = {
        "boards": {
            "A": {
                "variant_fen": "4k3/8/8/3n4/4P3/8/8/4K3[] w - - 0 1",
                "side_to_move": "white",
                "white_clock": "0:40",
                "black_clock": "0:36",
                "engine": {"bestmove": "e4d5", "score_cp": 220, "pv": ["e4d5"]},
            },
            "B": {
                "variant_fen": "4k3/8/8/8/8/8/8/4K3[] b - - 0 1",
                "side_to_move": "black",
                "white_clock": "0:38",
                "black_clock": "0:42",
                "engine": {"bestmove": "e8e7", "score_cp": 0, "pv": ["e8e7"]},
            },
        }
    }

    result = analyze_coupled_position(context)
    capture = next(item for item in result["candidate_impacts"] if item["board"] == "A")

    assert capture["legal"] is True
    assert capture["piece_transferred"] == "knight"
    assert capture["new_partner_pocket"] == "n"
    assert "Board B" in capture["impact_on_partner_board"]


def test_coach_rejects_unknown_game() -> None:
    request = CoachPrepareRequest(
        game_id=999,
        global_ply=0,
        question="What should we play?",
    )
    try:
        prepare_coach_context(request, FakeGames())
    except ValueError as exc:
        assert str(exc) == "Game not found"
    else:
        raise AssertionError("Unknown games must be rejected")
