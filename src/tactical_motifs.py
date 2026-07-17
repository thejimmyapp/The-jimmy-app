from __future__ import annotations

from dataclasses import dataclass

try:
    import chess
    import chess.variant
except ImportError:  # pragma: no cover - surfaced by the app at runtime.
    chess = None


TACTICAL_MOTIFS = [
    "pin",
    "fork",
    "skewer",
    "discovered attack",
    "double check",
    "deflection",
    "decoy",
    "removal of defender",
    "overloading",
    "interference",
    "zwischenzug",
    "hanging piece",
    "king pressure",
    "drop tactic",
    "quiet improvement",
]


PIECE_VALUES = {
    1: 100,
    2: 300,
    3: 300,
    4: 500,
    5: 900,
    6: 20000,
}


@dataclass(slots=True)
class MotifContext:
    before_fen: str | None
    bestmove: str | None
    played_move: str | None = None
    reason: str | None = None
    category: str | None = None


def classify_tactical_motif(
    before_fen: str | None,
    bestmove: str | None,
    played_move: str | None = None,
    reason: str | None = None,
    category: str | None = None,
) -> str:
    if chess is None or not before_fen or not bestmove:
        return _text_fallback(bestmove, played_move, reason, category)
    try:
        board = chess.variant.CrazyhouseBoard(before_fen)
        move = _parse_move(board, bestmove)
        if move is None or move not in board.legal_moves:
            return _text_fallback(bestmove, played_move, reason, category)
        return _classify_board_motif(board, move, played_move, reason, category)
    except Exception:
        return _text_fallback(bestmove, played_move, reason, category)


def _classify_board_motif(
    board: object,
    move: object,
    played_move: str | None,
    reason: str | None,
    category: str | None,
) -> str:
    if chess is None:
        return "quiet improvement"
    if board.is_capture(move):
        captured = _captured_piece(board, move)
        if captured and _is_hanging(board, move.to_square, captured.color):
            return "hanging piece"

    after = board.copy(stack=False)
    after.push(move)
    moved_piece = after.piece_at(move.to_square) if not getattr(move, "drop", None) else after.piece_at(move.to_square)
    gives_check = after.is_check()

    if gives_check and _king_must_move(after):
        return "double check"
    if moved_piece and _attacked_high_value_targets(after, move.to_square, not moved_piece.color) >= 2:
        return "fork"
    if gives_check and _is_line_piece(moved_piece):
        return "pin" if _text_has_check(reason, played_move) else "skewer"
    if board.is_capture(move):
        captured = _captured_piece(board, move)
        if captured and PIECE_VALUES.get(captured.piece_type, 0) >= 300:
            return "removal of defender"
        return "deflection"
    if getattr(move, "drop", None):
        if gives_check:
            return "drop tactic"
        if _attacked_high_value_targets(after, move.to_square, not board.turn) >= 1:
            return "fork"
    return _text_fallback(getattr(move, "uci", lambda: "")(), played_move, reason, category)


def _parse_move(board: object, text: str) -> object | None:
    if chess is None:
        return None
    raw = str(text or "").strip()
    if not raw:
        return None
    if "@" in raw:
        piece, square = raw.split("@", 1)
        return chess.Move.from_uci(f"{piece.upper()}@{square.lower()}")
    try:
        return chess.Move.from_uci(raw.lower())
    except ValueError:
        try:
            return board.parse_san(raw)
        except ValueError:
            return None


def _captured_piece(board: object, move: object) -> object | None:
    if chess is None:
        return None
    if board.is_en_passant(move):
        offset = -8 if board.turn == chess.WHITE else 8
        return board.piece_at(move.to_square + offset)
    return board.piece_at(move.to_square)


def _is_hanging(board: object, square: int, color: bool) -> bool:
    defenders = board.attackers(color, square)
    attackers = board.attackers(not color, square)
    return len(defenders) == 0 or len(attackers) > len(defenders)


def _attacked_high_value_targets(board: object, square: int, target_color: bool) -> int:
    if chess is None:
        return 0
    count = 0
    for target_square in board.attacks(square):
        piece = board.piece_at(target_square)
        if piece and piece.color == target_color and PIECE_VALUES.get(piece.piece_type, 0) >= 300:
            count += 1
    return count


def _king_must_move(board: object) -> bool:
    if chess is None or not board.is_check():
        return False
    king_square = board.king(board.turn)
    if king_square is None:
        return False
    legal = list(board.legal_moves)
    return bool(legal) and all(move.from_square == king_square for move in legal)


def _is_line_piece(piece: object | None) -> bool:
    if chess is None or piece is None:
        return False
    return piece.piece_type in {chess.BISHOP, chess.ROOK, chess.QUEEN}


def _text_has_check(reason: str | None, played_move: str | None) -> bool:
    text = f"{reason or ''} {played_move or ''}".lower()
    return "check" in text or "+" in text or "#" in text


def _text_fallback(
    bestmove: str | None,
    played_move: str | None,
    reason: str | None,
    category: str | None,
) -> str:
    text = f"{bestmove or ''} {played_move or ''} {reason or ''} {category or ''}".lower()
    if "double check" in text:
        return "double check"
    if "pin" in text:
        return "pin"
    if "skewer" in text:
        return "skewer"
    if "defender" in text:
        return "removal of defender"
    if "x" in text or "capture" in text or "trade" in text:
        return "hanging piece"
    if "@" in text:
        return "drop tactic"
    if "mate" in text or "check" in text or "+" in text or "#" in text:
        return "king pressure"
    return "quiet improvement"
