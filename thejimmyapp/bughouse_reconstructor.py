from __future__ import annotations

from dataclasses import dataclass, field

from thejimmyapp.pgn_parser import MoveRecord

try:
    import chess
    import chess.variant
except ImportError:  # pragma: no cover - handled at runtime in Streamlit.
    chess = None


PIECE_SYMBOL_TO_TYPE = {
    "P": 1,
    "N": 2,
    "B": 3,
    "R": 4,
    "Q": 5,
    "K": 6,
}


@dataclass(slots=True)
class BoardSnapshot:
    ply: int
    move: str
    fen: str | None
    board_text: str
    warning: str | None = None
    variant_fen: str | None = None
    reconstruction_mode: str = "standard"
    confidence: str = "medium"
    inferred_drops: int = 0
    failed_moves: list[str] = field(default_factory=list)
    pocket_summary: str = ""


def reconstruct_main_board(moves: list[MoveRecord], until_ply: int | None = None) -> BoardSnapshot:
    return reconstruct_bughouse_board(moves, until_ply=until_ply)


def reconstruct_bughouse_board(moves: list[MoveRecord], until_ply: int | None = None) -> BoardSnapshot:
    if chess is None:
        return BoardSnapshot(
            ply=0,
            move="start",
            fen=None,
            variant_fen=None,
            board_text="python-chess is not installed.",
            warning="Install python-chess to enable board reconstruction.",
            confidence="low",
        )

    board = chess.variant.CrazyhouseBoard()
    selected_moves = moves if until_ply is None else [move for move in moves if move.ply <= until_ply]
    last_move = "start"
    inferred_drops = 0
    failed_moves: list[str] = []

    for move in selected_moves:
        try:
            chess_move = _move_record_to_chess_move(board, move)
            if move.is_drop and chess_move not in board.legal_moves:
                _ensure_drop_piece(board, move)
                inferred_drops += 1
            if chess_move not in board.legal_moves:
                raise ValueError("move is not legal in reconstructed board")
            board.push(chess_move)
            last_move = move.display_move
        except Exception as exc:
            failed_moves.append(f"{move.display_move}: {exc}")
            return _snapshot(
                board=board,
                ply=move.ply - 1,
                move=last_move,
                inferred_drops=inferred_drops,
                failed_moves=failed_moves,
                warning=f"Stopped before {move.display_move}: could not apply move ({exc}).",
            )

    warning = None
    if inferred_drops:
        warning = (
            f"Reconstructed through drops by inferring {inferred_drops} pocket piece(s). "
            "Chess.com TCN does not expose partner-board captures, so pockets are approximate."
        )
    return _snapshot(
        board=board,
        ply=selected_moves[-1].ply if selected_moves else 0,
        move=last_move,
        inferred_drops=inferred_drops,
        failed_moves=failed_moves,
        warning=warning,
    )


def _move_record_to_chess_move(board: object, move: MoveRecord) -> object:
    if move.is_drop:
        piece_symbol = (move.drop_piece or move.san.split("@", 1)[0]).upper()
        to_square = (move.uci or move.san).split("@", 1)[1]
        return chess.Move.from_uci(f"{piece_symbol}@{to_square}")

    if move.uci:
        return chess.Move.from_uci(move.uci.lower())
    return board.parse_san(move.san)


def _ensure_drop_piece(board: object, move: MoveRecord) -> None:
    piece_symbol = (move.drop_piece or move.san.split("@", 1)[0]).upper()
    piece_type = PIECE_SYMBOL_TO_TYPE.get(piece_symbol)
    if piece_type is None:
        raise ValueError(f"unknown drop piece {piece_symbol!r}")
    board.pockets[board.turn].add(piece_type)


def _snapshot(
    board: object,
    ply: int,
    move: str,
    inferred_drops: int,
    failed_moves: list[str],
    warning: str | None,
) -> BoardSnapshot:
    variant_fen = board.fen()
    placement_fen = _strip_pockets_from_fen(variant_fen)
    confidence = "medium"
    if inferred_drops:
        confidence = "low"
    if failed_moves:
        confidence = "low"
    return BoardSnapshot(
        ply=ply,
        move=move,
        fen=placement_fen,
        variant_fen=variant_fen,
        board_text=board.unicode(empty_square=".", borders=True),
        warning=warning,
        reconstruction_mode="bughouse-inferred-pockets" if inferred_drops else "bughouse",
        confidence=confidence,
        inferred_drops=inferred_drops,
        failed_moves=failed_moves,
        pocket_summary=_pocket_summary(board),
    )


def _strip_pockets_from_fen(fen: str) -> str:
    parts = fen.split(" ", 1)
    placement = parts[0]
    while "[" in placement and "]" in placement:
        start = placement.index("[")
        end = placement.index("]", start)
        placement = placement[:start] + placement[end + 1 :]
    return f"{placement} {parts[1]}" if len(parts) > 1 else placement


def _pocket_summary(board: object) -> str:
    try:
        white = str(board.pockets[chess.WHITE]) or "-"
        black = str(board.pockets[chess.BLACK]) or "-"
    except Exception:
        return ""
    return f"White pocket: {white} | Black pocket: {black}"
