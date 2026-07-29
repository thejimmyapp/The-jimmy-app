from __future__ import annotations

import json
from typing import Any

from backend.coupled_analysis import analyze_coupled_position
from backend.schemas import CoachPrepareRequest
from backend.services import GameService


QUICK_QUESTIONS = [
    "What should our team play next?",
    "Was the last move a mistake?",
    "What is my partner threatening?",
    "Should I defend or attack?",
    "Which piece should I ask my partner for?",
    "Why did our position collapse?",
]


def prepare_coach_context(request: CoachPrepareRequest, games: GameService) -> dict[str, object]:
    game = games.get_game_payload(request.game_id)
    if not game:
        raise ValueError("Game not found")

    snapshot = games.snapshot(request.game_id, request.global_ply)
    board_a = request.board_a.model_dump() if request.board_a else _snapshot_board(snapshot, "board_a")
    board_b = request.board_b.model_dump() if request.board_b else _snapshot_board(snapshot, "board_b")
    timeline = game.get("timeline") if isinstance(game.get("timeline"), list) else []
    recent_moves = _recent_moves(timeline, request.global_ply)
    players = game.get("players") if isinstance(game.get("players"), dict) else {}
    suggestions = {item.board: item.model_dump(exclude_none=True) for item in request.engine_suggestions}

    context: dict[str, Any] = {
        "game_id": request.game_id,
        "global_ply": request.global_ply,
        "question": request.question,
        "reviewer": {
            "username": request.username,
            "board": "A",
            "color": request.user_color,
        },
        "players": players,
        "boards": {
            "A": {
                **(board_a or {"available": False}),
                "orientation": request.orientation_a,
                "last_move": _last_move(recent_moves, "A"),
                "engine": suggestions.get("A"),
            },
            "B": {
                **(board_b or {"available": False}),
                "orientation": request.orientation_b,
                "last_move": _last_move(recent_moves, "B"),
                "engine": suggestions.get("B"),
            },
        },
        "recent_moves": recent_moves,
        "annotations": [item.model_dump(exclude_none=True) for item in request.annotations],
        "bughouse_rules": [
            "A captured piece transfers to the capturing player's partner on the other board.",
            "Drops, partner requests, clocks, tempo and both kings must be evaluated together.",
            "Do not analyze the boards as independent chess games.",
            "A captured promoted piece returns to the partner as a pawn.",
        ],
        "data_limitations": game.get("limitations") or [],
    }
    coupled = analyze_coupled_position(context)
    context["coupled_analysis"] = coupled
    prompt = _build_prompt(context)
    return {
        "mode": "validated_context",
        "summary": "Fairy-Stockfish and coupled Bughouse facts are ready for Qwen.",
        "prompt": prompt,
        "context": context,
        "board_a": _board_preview(board_a, suggestions.get("A")),
        "board_b": _board_preview(board_b, suggestions.get("B")),
        "team_plan": [
            "Compare immediate checks, captures and drop threats on both boards.",
            "Check whether a capture helps your partner more than it helps the opposing team.",
            "Include clock pressure before recommending a forcing line.",
        ],
        "piece_requests": coupled["piece_requests"],
        "urgency": coupled["urgency"],
        "quick_questions": QUICK_QUESTIONS,
        "privacy": "Qwen runs through the app's local GGUF runtime. No external AI API key is used.",
    }


def _snapshot_board(snapshot: dict[str, object] | None, key: str) -> dict[str, object] | None:
    value = snapshot.get(key) if snapshot else None
    return dict(value) if isinstance(value, dict) else None


def _recent_moves(timeline: list[object], global_ply: int, limit: int = 12) -> list[dict[str, object]]:
    usable = [item for item in timeline if isinstance(item, dict) and int(item.get("global_ply", 0)) <= global_ply]
    return [
        {
            "global_ply": item.get("global_ply"),
            "board": item.get("board"),
            "local_ply": item.get("local_ply"),
            "move": item.get("move"),
        }
        for item in usable[-limit:]
    ]


def _last_move(recent_moves: list[dict[str, object]], board: str) -> str | None:
    return next((str(item.get("move")) for item in reversed(recent_moves) if item.get("board") == board), None)


def _board_preview(board: dict[str, object] | None, engine: dict[str, object] | None) -> dict[str, object]:
    if not board:
        return {"available": False, "best_move": None, "threats": [], "mistakes": []}
    return {
        "available": True,
        "best_move": engine.get("bestmove") if engine else None,
        "side_to_move": board.get("side_to_move"),
        "threats": [],
        "mistakes": [],
    }


def _urgency(suggestions: dict[str, dict[str, object]]) -> str:
    if any(item.get("mate_in") is not None for item in suggestions.values()):
        return "critical"
    return "unknown"


def _build_prompt(context: dict[str, Any]) -> str:
    serialized = json.dumps(context, ensure_ascii=True, indent=2, separators=(",", ": "))
    return f"""You are the explanation layer of a Bughouse coaching pipeline. You do not calculate chess moves. Answer the user's question using only the validated facts below.

Hard constraints:
- Move legality and tactical lines come exclusively from Fairy-Stockfish and the deterministic coupled analyzer.
- Never propose a move that is absent from candidate_impacts or engine PV data.
- Never invent a transfer, pocket piece, clock, mate, evaluation or missing board.
- Explain how verified captures change the other board and prioritize partner danger.
- If evidence is incomplete, say exactly what is missing.

Return these sections: Summary, Board A, Board B, Team plan, Piece request, Urgency.
Keep the complete answer concise and under 350 words.

POSITION CONTEXT
{serialized}
"""
