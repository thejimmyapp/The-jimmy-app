from __future__ import annotations

import json

import pytest

from backend.coach_output import validate_and_render_coach_output


def _facts(
    *,
    board_b: bool = True,
    clocks: bool = True,
    transfer: bool = False,
    mate: bool = False,
) -> dict[str, object]:
    board_a = {
        "available": True,
        "side_to_move": "White",
        "best_move": "e4d5" if transfer else "g1f3",
        "score_cp": None if mate else 35,
        "mate_in": 2 if mate else None,
        "depth": 10,
        "white_clock": "0:24" if clocks else None,
        "black_clock": "0:19" if clocks else None,
        "white_pocket": "N",
        "black_pocket": None,
    }
    board_b_facts = {
        "available": board_b,
        "side_to_move": "Black" if board_b else None,
        "best_move": "e8e7" if board_b else None,
        "score_cp": -20 if board_b else None,
        "mate_in": None,
        "depth": 10 if board_b else None,
        "white_clock": "0:31" if board_b and clocks else None,
        "black_clock": "0:28" if board_b and clocks else None,
        "white_pocket": None,
        "black_pocket": "P" if board_b else None,
    }
    missing = []
    if not clocks:
        missing.extend(["Board A white clock", "Board A black clock"])
    if not board_b:
        missing.append("Board B replay data")
    transfers = [{"board": "A", "move": "e4d5", "piece": "knight", "partner_impact": "knight added to the black partner pocket on Board B"}] if transfer else []
    catalog = {
        "position.global_ply": 8,
        "board_a.available": True,
        "board_a.side_to_move": "White",
        "board_a.best_move": board_a["best_move"],
        "team.urgency": "critical" if mate else "normal",
    }
    return {
        "source": "stored completed-game replay",
        "global_ply": 8,
        "boards": {"A": board_a, "B": board_b_facts},
        "transfers": transfers,
        "missing_data": missing,
        "urgency": "critical" if mate else "normal",
        "catalog": catalog,
    }


def _valid_output() -> str:
    section = {"fact_ids": ["board_a.best_move"], "explanation": "The cited engine candidate should anchor the team plan."}
    return json.dumps({"summary": section, "board_a": section, "board_b": {"fact_ids": [], "explanation": "Partner context should be treated according to the available evidence."}, "team_plan": section})


@pytest.mark.parametrize(
    "case",
    [
        _facts(),
        _facts(transfer=True),
        _facts(clocks=False),
        _facts(board_b=False),
        _facts(mate=True),
    ],
    ids=["starting-position", "capture-transfer", "missing-clocks", "missing-board-b", "mate-signal"],
)
def test_qwen_boundary_preserves_machine_rendered_facts(case: dict[str, object]) -> None:
    result = validate_and_render_coach_output({"facts": case}, _valid_output())

    assert result["validation"]["status"] == "passed"
    answer = str(result["answer"])
    assert "stored completed-game replay at global ply 8" in answer
    assert f"Urgency: {case['urgency']}" in answer
    if not case["boards"]["B"]["available"]:
        assert "Board B: unavailable" in answer
    if not case["boards"]["A"]["white_clock"]:
        assert "clocks White unavailable, Black unavailable" in answer


@pytest.mark.parametrize(
    ("explanation", "reason"),
    [
        ("Play g1f3 on both boards.", "raw move"),
        ("The best continuation is Nf3.", "chess notation"),
        ("Ask the partner to send a queen.", "piece-transfer claim"),
        ("Board B is White to move.", "side-to-move claim"),
        ("There is no time pressure.", "missing clock data"),
    ],
)
def test_qwen_boundary_rejects_factual_rewrites(explanation: str, reason: str) -> None:
    facts = _facts(clocks=False)
    section = {"fact_ids": ["board_a.best_move"], "explanation": explanation}
    raw = json.dumps({key: section for key in ("summary", "board_a", "board_b", "team_plan")})

    result = validate_and_render_coach_output({"facts": facts}, raw)

    assert result["validation"]["status"] == "rejected"
    assert reason in result["validation"]["reasons"][0]
    assert result["qwen_commentary"] is None


def test_qwen_boundary_rejects_unknown_fact_ids() -> None:
    section = {"fact_ids": ["invented.best_move"], "explanation": "This should not be accepted."}
    raw = json.dumps({key: section for key in ("summary", "board_a", "board_b", "team_plan")})

    result = validate_and_render_coach_output({"facts": _facts()}, raw)

    assert result["validation"]["status"] == "rejected"
    assert "unknown fact id" in result["validation"]["reasons"][0]


@pytest.mark.parametrize(
    ("section", "reason"),
    [
        (
            {
                "fact_ids": ["board_a.best_move", "position.global_ply"],
                "explanation": "Keep this concise.",
            },
            "too many fact_ids",
        ),
        (
            {
                "fact_ids": ["board_a.best_move"],
                "explanation": "one two three four five six seven eight nine ten eleven",
            },
            "10-word boundary",
        ),
        (
            {
                "fact_ids": ["board_a.best_move"],
                "explanation": "x" * 81,
            },
            "invalid explanation text",
        ),
    ],
)
def test_qwen_boundary_mirrors_schema_size_limits(
    section: dict[str, object],
    reason: str,
) -> None:
    raw = json.dumps({key: section for key in ("summary", "board_a", "board_b", "team_plan")})

    result = validate_and_render_coach_output({"facts": _facts()}, raw)

    assert result["validation"]["status"] == "rejected"
    assert reason in result["validation"]["reasons"][0]
