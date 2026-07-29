from __future__ import annotations

from copy import deepcopy
from typing import Any

import chess
import chess.variant


PIECE_NAMES = {
    chess.PAWN: "pawn",
    chess.KNIGHT: "knight",
    chess.BISHOP: "bishop",
    chess.ROOK: "rook",
    chess.QUEEN: "queen",
}


def analyze_coupled_position(context: dict[str, Any]) -> dict[str, Any]:
    """Convert engine facts into coupled Bughouse consequences before any LLM sees them."""
    boards = context.get("boards") if isinstance(context.get("boards"), dict) else {}
    candidates: list[dict[str, Any]] = []
    for board_id in ("A", "B"):
        board_data = boards.get(board_id) if isinstance(boards.get(board_id), dict) else None
        engine = board_data.get("engine") if board_data else None
        bestmove = engine.get("bestmove") if isinstance(engine, dict) else None
        if board_data and isinstance(bestmove, str) and bestmove:
            candidates.append(_candidate_impact(board_id, board_data, boards, engine, bestmove))

    urgency = _urgency(candidates)
    partner_danger = _partner_danger(candidates)
    piece_requests = _piece_requests(candidates)
    return {
        "source_of_truth": "deterministic Bughouse validator plus Fairy-Stockfish",
        "candidate_impacts": candidates,
        "partner_danger": partner_danger,
        "piece_requests": piece_requests,
        "urgency": urgency,
        "guardrails": [
            "Qwen may explain and prioritize these facts but may not override move legality.",
            "Qwen may not invent a transfer, pocket piece, clock, mate, or engine line.",
            "Missing second-board data must remain explicitly unavailable.",
        ],
    }


def _candidate_impact(
    board_id: str,
    board_data: dict[str, Any],
    boards: dict[str, Any],
    engine: dict[str, Any],
    bestmove: str,
) -> dict[str, Any]:
    other_id = "B" if board_id == "A" else "A"
    other_data = boards.get(other_id) if isinstance(boards.get(other_id), dict) else None
    result: dict[str, Any] = {
        "board": board_id,
        "move": bestmove,
        "legal": False,
        "impact_on_current_board": "unavailable",
        "impact_on_partner_board": "no verified transfer",
        "piece_transferred": None,
        "new_partner_pocket": None,
        "new_opponent_pocket": None,
        "mate_created": False,
        "mate_prevented": None,
        "time_required_estimate": "not measurable from a static engine snapshot",
        "time_remaining": _clock_for_side(board_data),
        "partner_danger": _engine_danger(other_data),
        "engine": deepcopy(engine),
    }
    try:
        board = chess.variant.CrazyhouseBoard(str(board_data.get("variant_fen") or ""))
        move = board.parse_uci(bestmove)
        if move not in board.legal_moves:
            result["impact_on_current_board"] = "Fairy-Stockfish move failed local legality validation"
            return result

        moving_color = board.turn
        captured_type = _captured_piece_type(board, move)
        captured_promoted = bool(move.to_square is not None and board.promoted & chess.BB_SQUARES[move.to_square])
        transferred_type = chess.PAWN if captured_promoted and captured_type else captured_type
        board.push(move)
        if captured_type:
            _remove_local_capture(board, moving_color, transferred_type or captured_type)
        result["legal"] = True
        result["mate_created"] = board.is_checkmate()
        result["impact_on_current_board"] = _local_impact(board, engine)

        if transferred_type and other_data:
            partner_board = chess.variant.CrazyhouseBoard(str(other_data.get("variant_fen") or ""))
            partner_color = not moving_color
            partner_board.pockets[partner_color].add(transferred_type)
            result["piece_transferred"] = PIECE_NAMES.get(transferred_type, chess.piece_name(transferred_type))
            result["impact_on_partner_board"] = (
                f"{result['piece_transferred']} added to the "
                f"{'white' if partner_color else 'black'} partner pocket on Board {other_id}"
            )
            result["new_partner_pocket"] = str(partner_board.pockets[partner_color]) or "-"
            result["new_opponent_pocket"] = str(partner_board.pockets[not partner_color]) or "-"
        elif transferred_type:
            result["impact_on_partner_board"] = "capture verified, but the partner board is unavailable"
    except (ValueError, TypeError, IndexError) as exc:
        result["impact_on_current_board"] = f"validation failed: {exc}"
    return result


def _captured_piece_type(board: chess.variant.CrazyhouseBoard, move: chess.Move) -> int | None:
    if not board.is_capture(move):
        return None
    if board.is_en_passant(move):
        return chess.PAWN
    piece = board.piece_at(move.to_square)
    return piece.piece_type if piece else None


def _remove_local_capture(board: chess.variant.CrazyhouseBoard, color: chess.Color, piece_type: int) -> None:
    try:
        board.pockets[color].remove(piece_type)
    except ValueError:
        pass


def _local_impact(board: chess.variant.CrazyhouseBoard, engine: dict[str, Any]) -> str:
    if board.is_checkmate():
        return "verified checkmate on this board"
    mate_in = engine.get("mate_in")
    if mate_in is not None:
        return f"forcing mate signal from Fairy-Stockfish: {mate_in}"
    score = engine.get("score_cp")
    return "Fairy-Stockfish tactical line" if score is None else f"Fairy-Stockfish score {score} cp"


def _clock_for_side(board_data: dict[str, Any]) -> str:
    side = str(board_data.get("side_to_move") or "").lower()
    return str(board_data.get("white_clock" if side == "white" else "black_clock") or "-")


def _engine_danger(board_data: dict[str, Any] | None) -> str:
    if not board_data:
        return "partner board unavailable"
    engine = board_data.get("engine")
    if not isinstance(engine, dict):
        return "partner board not yet analyzed"
    mate = engine.get("mate_in")
    if mate is not None:
        return f"mate signal {mate} on partner board"
    score = engine.get("score_cp")
    if isinstance(score, int) and score <= -300:
        return f"severe partner-board danger ({score} cp)"
    return "no critical partner-board signal from the current engine snapshot"


def _urgency(candidates: list[dict[str, Any]]) -> str:
    if any(item.get("mate_created") or item.get("engine", {}).get("mate_in") is not None for item in candidates):
        return "critical"
    if any("severe" in str(item.get("partner_danger")) for item in candidates):
        return "high"
    return "normal" if candidates else "unknown"


def _partner_danger(candidates: list[dict[str, Any]]) -> list[str]:
    return sorted({str(item["partner_danger"]) for item in candidates if item.get("partner_danger")})


def _piece_requests(candidates: list[dict[str, Any]]) -> list[str]:
    requests = []
    for item in candidates:
        piece = item.get("piece_transferred")
        if piece:
            requests.append(f"Board {item['board']} can send a {piece} with {item['move']}")
    return requests
