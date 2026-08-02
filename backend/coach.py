from __future__ import annotations

import json
from typing import Any, Iterable

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


def prepare_coach_context(
    request: CoachPrepareRequest,
    games: GameService,
    engine_suggestions: Iterable[dict[str, object]] = (),
) -> dict[str, object]:
    game = games.get_game_payload(request.game_id)
    if not game:
        raise ValueError("Game not found")

    snapshot = games.snapshot(request.game_id, request.global_ply)
    if not snapshot:
        raise ValueError("Stored replay position not found")
    board_a = _snapshot_board(snapshot, "board_a")
    board_b = _snapshot_board(snapshot, "board_b")
    if not board_a:
        raise ValueError("Stored Board A position not found")
    actual_ply = int(snapshot.get("global_ply") or 0)
    timeline = game.get("timeline") if isinstance(game.get("timeline"), list) else []
    recent_moves = _recent_moves(timeline, actual_ply)
    players = game.get("players") if isinstance(game.get("players"), dict) else {}
    suggestions = {
        str(item.get("board")): dict(item)
        for item in engine_suggestions
        if item.get("board") in {"A", "B"}
    }
    stored_game = game.get("game") if isinstance(game.get("game"), dict) else {}

    context: dict[str, Any] = {
        "game_id": request.game_id,
        "global_ply": actual_ply,
        "question": request.question,
        "reviewer": {
            "username": stored_game.get("username") or "Player",
            "board": "A",
            "color": stored_game.get("user_color") or "unknown",
        },
        "players": players,
        "boards": {
            "A": {
                **board_a,
                "available": True,
                "last_move": _last_move(recent_moves, "A"),
                "engine": suggestions.get("A"),
            },
            "B": {
                **(board_b or {"available": False}),
                "available": bool(board_b),
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
    facts = _coach_facts(actual_ply, board_a, board_b, suggestions, coupled)
    context["facts"] = facts
    prompt = _build_prompt(context)
    return {
        "mode": "validated_context",
        "summary": "Fairy-Stockfish and coupled Bughouse facts are ready for Qwen.",
        "prompt": prompt,
        "context": context,
        "facts": facts,
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


def _coach_facts(
    global_ply: int,
    board_a: dict[str, object],
    board_b: dict[str, object] | None,
    suggestions: dict[str, dict[str, object]],
    coupled: dict[str, Any],
) -> dict[str, object]:
    boards: dict[str, dict[str, object]] = {}
    catalog: dict[str, object] = {"position.global_ply": global_ply}
    missing: list[str] = []
    for board_id, board in (("A", board_a), ("B", board_b)):
        key = board_id.lower()
        engine = suggestions.get(board_id) or {}
        available = bool(board)
        board_facts = {
            "available": available,
            "side_to_move": board.get("side_to_move") if board else None,
            "best_move": engine.get("bestmove"),
            "score_cp": engine.get("score_cp"),
            "mate_in": engine.get("mate_in"),
            "depth": engine.get("depth"),
            "white_clock": _known_value(board.get("white_clock")) if board else None,
            "black_clock": _known_value(board.get("black_clock")) if board else None,
            "white_pocket": _known_value(board.get("white_pocket")) if board else None,
            "black_pocket": _known_value(board.get("black_pocket")) if board else None,
        }
        boards[board_id] = board_facts
        catalog[f"board_{key}.available"] = available
        for field, value in board_facts.items():
            if field != "available" and value is not None:
                catalog[f"board_{key}.{field}"] = value
        if not available:
            missing.append(f"Board {board_id} replay data")
        else:
            for color in ("white", "black"):
                if board_facts[f"{color}_clock"] is None:
                    missing.append(f"Board {board_id} {color} clock")
            if not engine:
                missing.append(f"Board {board_id} engine analysis")

    transfers: list[dict[str, object]] = []
    candidates = coupled.get("candidate_impacts")
    if isinstance(candidates, list):
        for index, item in enumerate(candidates):
            if not isinstance(item, dict) or not item.get("legal"):
                continue
            transfer = {
                "board": item.get("board"),
                "move": item.get("move"),
                "piece": item.get("piece_transferred"),
                "partner_impact": item.get("impact_on_partner_board"),
            }
            transfers.append(transfer)
            for field, value in transfer.items():
                if value is not None:
                    catalog[f"transfer_{index}.{field}"] = value
    urgency = str(coupled.get("urgency") or "unknown")
    catalog["team.urgency"] = urgency
    return {
        "source": "stored completed-game replay plus Fairy-Stockfish and deterministic transfer validation",
        "global_ply": global_ply,
        "boards": boards,
        "transfers": transfers,
        "missing_data": missing,
        "urgency": urgency,
        "catalog": catalog,
    }


def _known_value(value: object) -> object | None:
    if value is None or str(value).strip().lower() in {"", "-", "unknown", "n/a", "none"}:
        return None
    return value


def _build_prompt(context: dict[str, Any]) -> str:
    serialized = json.dumps(context, ensure_ascii=True, indent=2, separators=(",", ": "))
    return f"""You are the explanation layer of a Bughouse coaching pipeline. You do not calculate chess moves. Answer the user's question using only the validated facts below.

Hard constraints:
- Move legality and tactical lines come exclusively from Fairy-Stockfish and the deterministic coupled analyzer.
- Never propose a move that is absent from the fact catalog.
- Never invent a transfer, pocket piece, clock, mate, evaluation or missing board.
- Never infer side to move from board orientation.
- Explain how verified captures change the other board and prioritize partner danger.
- If evidence is incomplete, say exactly what is missing.

Return one strict JSON object and no Markdown. Use exactly these keys:
{{"summary": {{"fact_ids": [], "explanation": ""}}, "board_a": {{"fact_ids": [], "explanation": ""}}, "board_b": {{"fact_ids": [], "explanation": ""}}, "team_plan": {{"fact_ids": [], "explanation": ""}}}}
Every fact_ids entry must be an exact key from context.facts.catalog. Explanations may discuss why cited facts matter, but must not restate raw moves, clocks, evaluations, mate counts, sides to move, transfers, or urgency labels. The application renders those values deterministically. Keep the combined explanation under 180 words.

POSITION CONTEXT
{serialized}
"""
