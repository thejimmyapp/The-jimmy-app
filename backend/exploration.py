from __future__ import annotations

from dataclasses import asdict

import chess
import chess.variant

from backend.schemas import ExplorationMoveRequest, ExplorationSanMoveRequest
from thejimmyapp.board_renderer import _captured_piece_type_for_bughouse_transfer, replay_position_from_variant_fen


def apply_exploration_move(request: ExplorationMoveRequest) -> dict[str, object]:
    board_a = chess.variant.CrazyhouseBoard(request.board_a_fen)
    board_b = chess.variant.CrazyhouseBoard(request.board_b_fen) if request.board_b_fen else None
    if request.board == "B" and board_b is None:
        return {"legal": False, "reason": "The partner board is not available for exploration."}
    source = board_a if request.board == "A" else board_b
    if source is None:
        return {"legal": False, "reason": "This board is not available for exploration."}
    move = _requested_move(source, request)
    if move is None or move not in source.legal_moves:
        return {
            "legal": False,
            "reason": "This is not a legal move in the current Bughouse position.",
            "legal_destinations": _legal_destinations(source, request.from_square, request.drop_piece),
        }

    if request.dry_run:
        return {
            "legal": True,
            "notation": source.san(move),
            "legal_destinations": _legal_destinations(source, request.from_square, request.drop_piece),
        }

    return _apply_move(board_a, board_b, request.board, move, request.from_square, request.to_square)


def apply_exploration_san_move(request: ExplorationSanMoveRequest) -> dict[str, object]:
    board_a = chess.variant.CrazyhouseBoard(request.board_a_fen)
    board_b = chess.variant.CrazyhouseBoard(request.board_b_fen) if request.board_b_fen else None
    if request.board == "B" and board_b is None:
        return {"legal": False, "reason": "The partner board is not available for exploration."}
    source = board_a if request.board == "A" else board_b
    if source is None:
        return {"legal": False, "reason": "This board is not available for exploration."}
    try:
        move = source.parse_san(request.san)
    except ValueError:
        return {"legal": False, "reason": "This notation is not legal in the current Bughouse position."}
    from_square = chess.square_name(move.from_square) if move.drop is None else None
    to_square = chess.square_name(move.to_square)
    return _apply_move(board_a, board_b, request.board, move, from_square, to_square)


def _apply_move(
    board_a: chess.variant.CrazyhouseBoard,
    board_b: chess.variant.CrazyhouseBoard | None,
    board_id: str,
    move: chess.Move,
    from_square: str | None,
    to_square: str,
) -> dict[str, object]:
    source = board_a if board_id == "A" else board_b
    if source is None or move not in source.legal_moves:
        return {"legal": False, "reason": "This is not a legal move in the current Bughouse position."}
    partner = board_b if board_id == "A" else board_a
    notation = source.san(move)

    capturer = source.turn
    captured_type = _captured_piece_type_for_bughouse_transfer(source, move)
    source.push(move)
    if captured_type is not None:
        if source.pockets[capturer].count(captured_type):
            source.pockets[capturer].remove(captured_type)
        if partner is not None:
            partner.pockets[not capturer].add(captured_type)

    board_a_fen = board_a.fen()
    board_b_fen = board_b.fen() if board_b is not None else None
    position_a = replay_position_from_variant_fen(board_a_fen, "Exploration")
    position_b = replay_position_from_variant_fen(board_b_fen, "Exploration") if board_b_fen else None
    active_position = position_a if board_id == "A" else position_b
    if active_position is not None:
        active_position.from_square = from_square
        active_position.to_square = to_square
    return {
        "legal": True,
        "notation": notation,
        "board_a_fen": board_a_fen,
        "board_b_fen": board_b_fen,
        "board_a": asdict(position_a),
        "board_b": asdict(position_b) if position_b is not None else None,
        "capture_transferred": captured_type is not None and partner is not None,
    }


def _requested_move(board: chess.variant.CrazyhouseBoard, request: ExplorationMoveRequest) -> chess.Move | None:
    if request.drop_piece:
        return chess.Move.from_uci(f"{request.drop_piece}@{request.to_square}")
    if not request.from_square:
        return None
    base = f"{request.from_square}{request.to_square}"
    candidates = [request.promotion] if request.promotion else [None, "q", "r", "b", "n"]
    for promotion in candidates:
        try:
            move = chess.Move.from_uci(base + (promotion or ""))
        except ValueError:
            continue
        if move in board.legal_moves:
            return move
    try:
        return chess.Move.from_uci(base)
    except ValueError:
        return None


def _legal_destinations(
    board: chess.variant.CrazyhouseBoard,
    from_square: str | None,
    drop_piece: str | None,
) -> list[str]:
    destinations: set[str] = set()
    from_index = chess.parse_square(from_square) if from_square else None
    drop_type = chess.PIECE_SYMBOLS.index(drop_piece.lower()) if drop_piece else None
    for move in board.legal_moves:
        if from_index is not None and move.from_square == from_index:
            destinations.add(chess.square_name(move.to_square))
        elif drop_type is not None and move.drop == drop_type:
            destinations.add(chess.square_name(move.to_square))
    return sorted(destinations)
