from __future__ import annotations

import html
import json
from dataclasses import asdict, dataclass

from thejimmyapp.bughouse_reconstructor import BoardSnapshot, reconstruct_bughouse_board
from thejimmyapp.pgn_parser import CriticalMoment, MoveRecord, format_seconds

try:
    import chess
    import chess.variant
except ImportError:  # pragma: no cover - surfaced elsewhere in the app.
    chess = None


PIECES = {
    "P": "♙",
    "N": "♘",
    "B": "♗",
    "R": "♖",
    "Q": "♕",
    "K": "♔",
    "p": "♟",
    "n": "♞",
    "b": "♝",
    "r": "♜",
    "q": "♛",
    "k": "♚",
}


@dataclass(slots=True)
class ReplayPosition:
    ply: int
    label: str
    board: list[list[str]]
    side_to_move: str
    fen: str
    variant_fen: str
    white_pocket: str
    black_pocket: str
    white_clock: str
    black_clock: str
    elapsed_seconds: float | None
    partner_index: int | None
    confidence: str
    warning: str
    from_square: str | None
    to_square: str | None


@dataclass(slots=True)
class GlobalReplayFrame:
    global_ply: int
    board: str
    local_ply: int
    move: str
    board_a: ReplayPosition
    board_b: ReplayPosition


def render_game_replay_html(
    moves: list[MoveRecord],
    critical: list[CriticalMoment],
    partner_moves: list[MoveRecord] | None = None,
    engine_suggestions: list[dict[str, object]] | None = None,
    player_labels: dict[str, object] | None = None,
    critical_ply_offset: int = 0,
    selected_ply: int | None = None,
    orientation: str = "white",
    title: str = "Main board",
) -> str:
    if partner_moves:
        positions, partner_positions = build_bughouse_pair_positions(moves, partner_moves)
    else:
        positions = build_replay_positions(moves)
        partner_positions = []
    critical_payload = [
        {
            "ply": max(0, min(len(moves), item.ply + critical_ply_offset)),
            "move": item.move,
            "reason": item.reason,
        }
        for item in critical
        if 0 <= item.ply <= len(moves)
    ]
    initial_ply = selected_ply if selected_ply is not None else len(moves)
    initial_ply = max(0, min(initial_ply, len(moves)))

    return _html(
        positions=[asdict(position) for position in positions],
        partner_positions=[asdict(position) for position in partner_positions],
        critical=critical_payload,
        engine_suggestions=engine_suggestions or [],
        player_labels=player_labels or {},
        initial_ply=initial_ply,
        orientation="black" if orientation == "black" else "white",
        title=title,
    )


def render_pattern_puzzle_html(
    fen: str,
    orientation: str = "white",
    title: str = "Pattern puzzle",
    solution: str | None = None,
) -> str:
    placement, pockets, side_to_move = _split_variant_fen(fen)
    position = ReplayPosition(
        ply=0,
        label=title,
        board=_placement_to_matrix(placement),
        side_to_move="White" if side_to_move == "w" else "Black",
        fen=_strip_pockets_from_fen(fen),
        variant_fen=fen,
        white_pocket=pockets.get("white", "-"),
        black_pocket=pockets.get("black", "-"),
        white_clock="-",
        black_clock="-",
        elapsed_seconds=None,
        partner_index=None,
        confidence="high",
        warning="",
        from_square=None,
        to_square=None,
    )
    suggestions = [{"ply": 0, "bestmove": solution}] if solution else []
    return _html(
        positions=[asdict(position)],
        partner_positions=[],
        critical=[],
        engine_suggestions=suggestions,
        player_labels={},
        initial_ply=0,
        orientation="black" if orientation == "black" else "white",
        title=title,
    )


def render_dual_position_html(
    main_fen: str,
    partner_fen: str,
    orientation: str = "white",
    title: str = "Free study",
    player_labels: dict[str, object] | None = None,
) -> str:
    """Render a static two-board Bughouse workspace from variant FEN strings."""
    main_position = _position_from_variant_fen(main_fen, title)
    partner_position = _position_from_variant_fen(partner_fen, "Partner board")
    main_position.partner_index = 0
    partner_position.partner_index = 0
    return _html(
        positions=[asdict(main_position)],
        partner_positions=[asdict(partner_position)],
        critical=[],
        engine_suggestions=[],
        player_labels=player_labels or {},
        initial_ply=0,
        orientation="black" if orientation == "black" else "white",
        title=title,
    )


def _position_from_variant_fen(fen: str, label: str) -> ReplayPosition:
    placement, pockets, side_to_move = _split_variant_fen(fen)
    return ReplayPosition(
        ply=0,
        label=label,
        board=_placement_to_matrix(placement),
        side_to_move="White" if side_to_move == "w" else "Black",
        fen=_strip_pockets_from_fen(fen),
        variant_fen=fen,
        white_pocket=pockets.get("white", "-"),
        black_pocket=pockets.get("black", "-"),
        white_clock="-",
        black_clock="-",
        elapsed_seconds=None,
        partner_index=0,
        confidence="study",
        warning="",
        from_square=None,
        to_square=None,
    )


def replay_position_from_variant_fen(fen: str, label: str = "Position") -> ReplayPosition:
    """Public API for serializing a validated Crazyhouse/Bughouse FEN."""
    if chess is not None:
        chess.variant.CrazyhouseBoard(fen)
    return _position_from_variant_fen(fen, label)


def build_replay_positions(moves: list[MoveRecord]) -> list[ReplayPosition]:
    positions: list[ReplayPosition] = []
    for ply in range(0, len(moves) + 1):
        snapshot = reconstruct_bughouse_board(moves, until_ply=ply)
        move = moves[ply - 1] if ply else None
        positions.append(_position_from_snapshot(snapshot, move, moves[:ply]))
    return positions


def build_bughouse_pair_positions(
    main_moves: list[MoveRecord],
    partner_moves: list[MoveRecord],
) -> tuple[list[ReplayPosition], list[ReplayPosition]]:
    if chess is None:
        return build_replay_positions(main_moves), build_replay_positions(partner_moves)

    main_board = chess.variant.CrazyhouseBoard()
    partner_board = chess.variant.CrazyhouseBoard()
    main_positions = [_position_from_live_board(main_board, 0, None, [], "")]
    partner_positions = [_position_from_live_board(partner_board, 0, None, [], "")]
    main_positions[0].partner_index = 0
    partner_positions[0].partner_index = 0
    main_warning = ""
    partner_warning = ""
    main_stopped = False
    partner_stopped = False
    main_debt: dict[tuple[bool, int], int] = {}
    partner_debt: dict[tuple[bool, int], int] = {}
    main_played: list[MoveRecord] = []
    partner_played: list[MoveRecord] = []
    last_partner_move: MoveRecord | None = None
    timeline, clock_confident = _combined_timeline(main_moves, partner_moves)

    for board_name, local_ply, current_move in timeline:
        if board_name == "main":
            main_played.append(current_move)
            inferred = False
            if not main_stopped:
                try:
                    inferred = _apply_bughouse_move(
                        main_board,
                        partner_board,
                        current_move,
                        transfer_to_partner=True,
                        drop_debt=main_debt,
                        partner_drop_debt=partner_debt,
                    )
                except Exception as exc:
                    main_warning = f"Stopped before {current_move.display_move}: {exc}"
                    main_stopped = True
            if inferred:
                main_warning = _merge_warning(
                    main_warning,
                    "A drop arrived before its matching capture in the available timeline; pocket confidence is low.",
                )
            if not clock_confident:
                main_warning = _merge_warning(
                    main_warning,
                    "Exact cross-board clocks were unavailable; equal-ply ordering is approximate.",
                )

            main_position = _position_from_live_board(
                main_board,
                local_ply,
                current_move,
                main_played,
                main_warning,
            )
            partner_position = _position_from_live_board(
                partner_board,
                len(partner_played),
                last_partner_move,
                partner_played,
                partner_warning or main_warning,
            )
            main_position.partner_index = len(partner_positions)
            partner_position.partner_index = len(main_positions)
            main_positions.append(main_position)
            partner_positions.append(partner_position)
            continue

        partner_played.append(current_move)
        last_partner_move = current_move
        inferred = False
        if not partner_stopped:
            try:
                inferred = _apply_bughouse_move(
                    partner_board,
                    main_board,
                    current_move,
                    transfer_to_partner=True,
                    drop_debt=partner_debt,
                    partner_drop_debt=main_debt,
                )
            except Exception as exc:
                partner_warning = f"Stopped before {current_move.display_move}: {exc}"
                partner_stopped = True
        if inferred:
            partner_warning = _merge_warning(
                partner_warning,
                "A drop arrived before its matching capture in the available timeline; pocket confidence is low.",
            )

    return main_positions, partner_positions


def build_global_replay_frames(
    main_moves: list[MoveRecord],
    partner_moves: list[MoveRecord],
) -> list[GlobalReplayFrame]:
    """Build deterministic two-board snapshots after every move on either board."""
    if chess is None:
        return []
    main_board = chess.variant.CrazyhouseBoard()
    partner_board = chess.variant.CrazyhouseBoard()
    main_played: list[MoveRecord] = []
    partner_played: list[MoveRecord] = []
    main_debt: dict[tuple[bool, int], int] = {}
    partner_debt: dict[tuple[bool, int], int] = {}
    main_warning = ""
    partner_warning = ""
    main_stopped = False
    partner_stopped = False
    main_position = _position_from_live_board(main_board, 0, None, [], "")
    partner_position = _position_from_live_board(partner_board, 0, None, [], "")
    frames = [
        GlobalReplayFrame(
            global_ply=0,
            board="A",
            local_ply=0,
            move="Start",
            board_a=main_position,
            board_b=partner_position,
        )
    ]
    timeline, clock_confident = _combined_timeline(main_moves, partner_moves)
    ordering_warning = (
        ""
        if clock_confident
        else "Cross-board move order is approximate because complete clock timestamps are unavailable."
    )
    for global_ply, (board_name, local_ply, move) in enumerate(timeline, start=1):
        if board_name == "main":
            if not main_stopped:
                try:
                    inferred = _apply_bughouse_move(
                        main_board,
                        partner_board,
                        move,
                        transfer_to_partner=True,
                        drop_debt=main_debt,
                        partner_drop_debt=partner_debt,
                    )
                    main_played.append(move)
                    if inferred:
                        main_warning = _merge_warning(
                            main_warning,
                            "A drop arrived before its matching capture; pocket confidence is low.",
                        )
                except Exception as exc:
                    main_warning = _merge_warning(main_warning, f"Stopped before {move.display_move}: {exc}")
                    main_stopped = True
        else:
            if not partner_stopped:
                try:
                    inferred = _apply_bughouse_move(
                        partner_board,
                        main_board,
                        move,
                        transfer_to_partner=True,
                        drop_debt=partner_debt,
                        partner_drop_debt=main_debt,
                    )
                    partner_played.append(move)
                    if inferred:
                        partner_warning = _merge_warning(
                            partner_warning,
                            "A drop arrived before its matching capture; pocket confidence is low.",
                        )
                except Exception as exc:
                    partner_warning = _merge_warning(partner_warning, f"Stopped before {move.display_move}: {exc}")
                    partner_stopped = True
        frame_main_warning = _merge_warning(main_warning, ordering_warning) if ordering_warning else main_warning
        frame_partner_warning = _merge_warning(partner_warning, ordering_warning) if ordering_warning else partner_warning
        main_position = _position_from_live_board(
            main_board,
            len(main_played),
            main_played[-1] if main_played else None,
            main_played,
            frame_main_warning,
        )
        partner_position = _position_from_live_board(
            partner_board,
            len(partner_played),
            partner_played[-1] if partner_played else None,
            partner_played,
            frame_partner_warning,
        )
        main_position.partner_index = global_ply
        partner_position.partner_index = global_ply
        frames.append(
            GlobalReplayFrame(
                global_ply=global_ply,
                board="A" if board_name == "main" else "B",
                local_ply=local_ply,
                move=move.display_move,
                board_a=main_position,
                board_b=partner_position,
            )
        )
    return frames


def _combined_timeline(
    main_moves: list[MoveRecord],
    partner_moves: list[MoveRecord],
) -> tuple[list[tuple[str, int, MoveRecord]], bool]:
    main_times, main_has_clocks = _event_times(main_moves)
    partner_times, partner_has_clocks = _event_times(partner_moves)
    events = [
        (main_times[index], 0, move.ply, "main", move)
        for index, move in enumerate(main_moves)
    ]
    events.extend(
        (partner_times[index], 1, move.ply, "partner", move)
        for index, move in enumerate(partner_moves)
    )
    events.sort(key=lambda item: (item[0], item[1], item[2]))
    return [(board_name, ply, move) for _, _, ply, board_name, move in events], main_has_clocks and partner_has_clocks


def _event_times(moves: list[MoveRecord]) -> tuple[list[float], bool]:
    if moves and all(move.elapsed_seconds is not None for move in moves):
        return [float(move.elapsed_seconds or 0.0) for move in moves], True

    clocks = [move.clock_seconds for move in moves if move.clock_seconds is not None]
    if not clocks:
        return [float(move.ply) for move in moves], False

    initial_clock = max(clocks)
    previous = {"white": initial_clock, "black": initial_clock}
    elapsed = 0.0
    values: list[float] = []
    for move in moves:
        if move.clock_seconds is None:
            elapsed += 0.001
        else:
            elapsed += max(0.0, previous.get(move.color, initial_clock) - move.clock_seconds)
            previous[move.color] = move.clock_seconds
        values.append(elapsed)
    return values, True


def _merge_warning(current: str, addition: str) -> str:
    if not current:
        return addition
    if addition in current:
        return current
    return f"{current} {addition}"


def _position_from_snapshot(
    snapshot: BoardSnapshot,
    move: MoveRecord | None,
    played_moves: list[MoveRecord],
) -> ReplayPosition:
    variant_fen = snapshot.variant_fen or snapshot.fen or ""
    placement, pockets, side_to_move = _split_variant_fen(variant_fen)
    from_square, to_square = _move_squares(move)
    clocks = _position_clocks(played_moves)
    return ReplayPosition(
        ply=snapshot.ply,
        label="Start position" if move is None else move.display_move,
        board=_placement_to_matrix(placement),
        side_to_move="White" if side_to_move == "w" else "Black",
        fen=snapshot.fen or "",
        variant_fen=variant_fen,
        white_pocket=pockets.get("white", "-"),
        black_pocket=pockets.get("black", "-"),
        white_clock=clocks["white"],
        black_clock=clocks["black"],
        elapsed_seconds=_position_elapsed_seconds(played_moves),
        partner_index=None,
        confidence=snapshot.confidence,
        warning=snapshot.warning or "",
        from_square=from_square,
        to_square=to_square,
    )


def _position_from_live_board(
    board: object,
    ply: int,
    move: MoveRecord | None,
    played_moves: list[MoveRecord],
    warning: str,
) -> ReplayPosition:
    variant_fen = board.fen()
    placement, pockets, side_to_move = _split_variant_fen(variant_fen)
    from_square, to_square = _move_squares(move)
    clocks = _position_clocks(played_moves)
    return ReplayPosition(
        ply=ply,
        label="Start position" if move is None else move.display_move,
        board=_placement_to_matrix(placement),
        side_to_move="White" if side_to_move == "w" else "Black",
        fen=_strip_pockets_from_fen(variant_fen),
        variant_fen=variant_fen,
        white_pocket=pockets.get("white", "-"),
        black_pocket=pockets.get("black", "-"),
        white_clock=clocks["white"],
        black_clock=clocks["black"],
        elapsed_seconds=_position_elapsed_seconds(played_moves),
        partner_index=None,
        confidence="medium" if not warning else "low",
        warning=warning,
        from_square=from_square,
        to_square=to_square,
    )


def _apply_bughouse_move(
    board: object,
    partner_board: object,
    move: MoveRecord,
    transfer_to_partner: bool,
    drop_debt: dict[tuple[bool, int], int] | None = None,
    partner_drop_debt: dict[tuple[bool, int], int] | None = None,
) -> bool:
    chess_move = _move_record_to_chess_move(board, move)
    inferred_drop = False
    injected_piece_type: int | None = None
    if move.is_drop and chess_move not in board.legal_moves:
        piece_type = _ensure_drop_piece(board, move)
        injected_piece_type = piece_type
        if chess_move in board.legal_moves:
            inferred_drop = True
            if drop_debt is not None:
                key = (board.turn, piece_type)
                drop_debt[key] = drop_debt.get(key, 0) + 1
    if chess_move not in board.legal_moves:
        if injected_piece_type is not None:
            _remove_from_pocket(board, board.turn, injected_piece_type)
        raise ValueError("move is not legal in reconstructed board")

    capturer = board.turn
    captured_type = _captured_piece_type_for_bughouse_transfer(board, chess_move)
    move.is_capture = captured_type is not None
    board.push(chess_move)
    move.is_check = bool(board.is_check())
    move.is_mate = bool(board.is_checkmate())
    if captured_type is not None and transfer_to_partner:
        _remove_from_pocket(board, capturer, captured_type)
        partner_color = not capturer
        debt_key = (partner_color, captured_type)
        debt = partner_drop_debt.get(debt_key, 0) if partner_drop_debt is not None else 0
        if debt > 0 and partner_drop_debt is not None:
            if debt == 1:
                partner_drop_debt.pop(debt_key, None)
            else:
                partner_drop_debt[debt_key] = debt - 1
        else:
            partner_board.pockets[partner_color].add(captured_type)
    return inferred_drop


def _move_record_to_chess_move(board: object, move: MoveRecord) -> object:
    if chess is None:
        raise ValueError("python-chess is not installed")
    if move.is_drop:
        piece_symbol = (move.drop_piece or move.san.split("@", 1)[0]).upper()
        to_square = (move.uci or move.san).split("@", 1)[1]
        return chess.Move.from_uci(f"{piece_symbol}@{to_square}")
    if move.uci:
        return chess.Move.from_uci(move.uci.lower())
    return board.parse_san(move.san)


def _ensure_drop_piece(board: object, move: MoveRecord) -> int:
    if chess is None:
        raise ValueError("python-chess is not installed")
    piece_symbol = (move.drop_piece or move.san.split("@", 1)[0]).upper()
    piece_type = {
        "P": chess.PAWN,
        "N": chess.KNIGHT,
        "B": chess.BISHOP,
        "R": chess.ROOK,
        "Q": chess.QUEEN,
    }.get(piece_symbol)
    if piece_type is None:
        raise ValueError(f"unknown drop piece {piece_symbol!r}")
    board.pockets[board.turn].add(piece_type)
    return piece_type


def _captured_piece_type_for_bughouse_transfer(board: object, move: object) -> int | None:
    if chess is None:
        return None
    if board.is_en_passant(move):
        offset = -8 if board.turn == chess.WHITE else 8
        captured_square = move.to_square + offset
        captured = board.piece_at(captured_square)
    else:
        captured_square = move.to_square
        captured = board.piece_at(captured_square)
    if captured is None:
        return None
    if board.promoted & chess.BB_SQUARES[captured_square]:
        return chess.PAWN
    return captured.piece_type


def _remove_from_pocket(board: object, color: bool, piece_type: int) -> None:
    pocket = board.pockets[color]
    try:
        if pocket.count(piece_type) > 0:
            pocket.remove(piece_type)
    except Exception:
        pass


def _split_variant_fen(fen: str) -> tuple[str, dict[str, str], str]:
    if not fen:
        return "8/8/8/8/8/8/8/8", {"white": "-", "black": "-"}, "w"
    first, *rest = fen.split()
    side = rest[0] if rest else "w"
    pockets = {"white": "-", "black": "-"}
    placement = first
    if "[" in first and "]" in first:
        start = first.index("[")
        end = first.index("]", start)
        pocket_text = first[start + 1 : end]
        placement = first[:start] + first[end + 1 :]
        white = "".join(ch for ch in pocket_text if ch.isupper())
        black = "".join(ch for ch in pocket_text if ch.islower())
        pockets = {"white": white or "-", "black": black or "-"}
    return placement, pockets, side


def _strip_pockets_from_fen(fen: str) -> str:
    parts = fen.split(" ", 1)
    placement = parts[0]
    while "[" in placement and "]" in placement:
        start = placement.index("[")
        end = placement.index("]", start)
        placement = placement[:start] + placement[end + 1 :]
    return f"{placement} {parts[1]}" if len(parts) > 1 else placement


def _placement_to_matrix(placement: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for rank in placement.split("/"):
        row: list[str] = []
        for char in rank:
            if char.isdigit():
                row.extend([""] * int(char))
            else:
                row.append(char)
        rows.append((row + [""] * 8)[:8])
    while len(rows) < 8:
        rows.append([""] * 8)
    return rows[:8]


def _move_squares(move: MoveRecord | None) -> tuple[str | None, str | None]:
    if move is None or not move.uci:
        return None, None
    if "@" in move.uci:
        return None, move.uci.split("@", 1)[1]
    if len(move.uci) >= 4:
        return move.uci[:2], move.uci[2:4]
    return None, None


def _position_clocks(moves: list[MoveRecord]) -> dict[str, str]:
    clocks: dict[str, str] = {"white": "-", "black": "-"}
    for move in moves:
        if move.clock_seconds is None:
            continue
        clocks[move.color] = format_seconds(move.clock_seconds)
    return clocks


def _position_elapsed_seconds(moves: list[MoveRecord]) -> float | None:
    if moves and moves[-1].elapsed_seconds is not None:
        return moves[-1].elapsed_seconds
    clocks = [move.clock_seconds for move in moves if move.clock_seconds is not None]
    if not clocks:
        return None
    initial_clock = max(clocks)
    lowest_clock_seen = min(clocks)
    return max(0.0, initial_clock - lowest_clock_seen)


def _attach_partner_indices(
    main_positions: list[ReplayPosition],
    partner_positions: list[ReplayPosition],
) -> None:
    partner_elapsed = [position.elapsed_seconds for position in partner_positions]
    for position in main_positions:
        if position.elapsed_seconds is None:
            position.partner_index = min(position.ply, len(partner_positions) - 1)
        else:
            position.partner_index = _closest_elapsed_index(partner_elapsed, position.elapsed_seconds)


def _closest_elapsed_index(values: list[float | None], target: float) -> int:
    best_index = 0
    best_distance = float("inf")
    for idx, value in enumerate(values):
        if value is None:
            continue
        distance = abs(value - target)
        if distance < best_distance:
            best_distance = distance
            best_index = idx
    return best_index


def _json_for_script(value: object) -> str:
    return json.dumps(value, ensure_ascii=False).replace("</", "<\\/")


def _html(
    positions: list[dict[str, object]],
    partner_positions: list[dict[str, object]],
    critical: list[dict[str, object]],
    engine_suggestions: list[dict[str, object]],
    player_labels: dict[str, object],
    initial_ply: int,
    orientation: str,
    title: str,
) -> str:
    positions_json = _json_for_script(positions)
    partner_positions_json = _json_for_script(partner_positions)
    critical_json = _json_for_script(critical)
    engine_suggestions_json = _json_for_script(engine_suggestions)
    player_labels_json = _json_for_script(player_labels)
    safe_title = html.escape(title)
    return f"""
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  :root {{
    color-scheme: dark;
    --bg: #0e1117;
    --panel: #151922;
    --panel-2: #1b2130;
    --line: #2c3444;
    --light: #e8edf7;
    --muted: #9ca8ba;
    --wood-light: #f0d4a2;
    --wood-dark: #a9703b;
    --wood-edge: #5b341f;
    --accent: #4f8cff;
    --warn: #f2c94c;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    background: var(--bg);
    color: var(--light);
    font-family: Inter, "Segoe UI", Arial, sans-serif;
  }}
  .wrap {{
    width: 100%;
    padding: 4px 0 8px;
  }}
  .topline {{
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }}
  .status {{
    min-width: 0;
  }}
  .move-title {{
    font-size: 18px;
    font-weight: 700;
    line-height: 1.25;
  }}
  .meta {{
    margin-top: 3px;
    color: var(--muted);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}
  .matchup {{
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 10px;
    align-items: stretch;
    margin: 0 0 12px;
  }}
  .team {{
    border: 1px solid var(--line);
    background: #111827;
    border-radius: 8px;
    padding: 9px 11px;
    min-width: 0;
  }}
  .team-label {{
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .04em;
    margin-bottom: 3px;
  }}
  .team-names {{
    color: var(--light);
    font-weight: 700;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}
  .versus {{
    display: grid;
    place-items: center;
    color: var(--muted);
    font-weight: 700;
    padding: 0 2px;
  }}
  .boards {{
    display: grid;
    grid-template-columns: minmax(280px, 520px) minmax(240px, 420px);
    gap: 18px;
    align-items: start;
  }}
  .board-panel {{
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 12px;
  }}
  .board-header {{
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--muted);
  }}
  .board-title {{
    color: var(--light);
    font-weight: 700;
  }}
  .players {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 10px;
  }}
  /* Legacy duplicate pocket cards are intentionally hidden. Pocket inventory
     is displayed only on the rails beside each board. */
  .pockets,
  #whitePocketVisual,
  #blackPocketVisual,
  #partnerWhitePocketVisual,
  #partnerBlackPocketVisual {{
    display: none !important;
  }}
  .player-card {{
    border: 1px solid var(--line);
    background: #101722;
    border-radius: 6px;
    padding: 7px 9px;
    min-width: 0;
  }}
  .player-color {{
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .04em;
  }}
  .player-name {{
    color: var(--light);
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}
  .player-role {{
    display: inline-block;
    margin-top: 4px;
    padding: 2px 6px;
    border-radius: 999px;
    background: rgba(79, 140, 255, .16);
    border: 1px solid rgba(79, 140, 255, .38);
    color: #b9d2ff;
    font-size: 11px;
  }}
  .clock-row {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 10px;
  }}
  .clock {{
    border: 1px solid var(--line);
    background: #111722;
    border-radius: 6px;
    padding: 7px 9px;
    font-size: 13px;
    color: var(--muted);
  }}
  .clock strong {{
    color: var(--light);
    font-family: Consolas, monospace;
    font-size: 15px;
  }}
  .pocket-count {{
    position: absolute;
    right: -3px;
    bottom: -2px;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    border-radius: 999px;
    background: rgba(18, 22, 30, .92);
    border: 1px solid rgba(255,255,255,.2);
    color: #fff;
    font-size: 10px;
    line-height: 13px;
    text-align: center;
  }}
  .board-stage {{
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) 34px;
    gap: 6px;
    align-items: stretch;
  }}
  .pocket-rail {{
    min-width: 0;
    border: 1px solid rgba(0,0,0,.25);
    border-radius: 4px;
    background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(0,0,0,.18));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 5px 2px;
    overflow: hidden;
  }}
  .rail-label {{
    color: var(--muted);
    font-size: 10px;
    font-weight: 700;
  }}
  .rail-piece {{
    width: 29px;
    min-height: 29px;
    display: grid;
    place-items: center;
    position: relative;
  }}
  .rail-piece img {{
    width: 30px;
    height: 30px;
    object-fit: contain;
    filter: drop-shadow(0 1px 1px rgba(0,0,0,.45));
  }}
  .chessboard {{
    width: 100%;
    aspect-ratio: 1;
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    grid-template-rows: repeat(8, 1fr);
    border: 3px solid var(--wood-edge);
    overflow: hidden;
    border-radius: 2px;
    box-shadow:
      0 10px 24px rgba(0,0,0,.32),
      inset 0 0 0 1px rgba(255,255,255,.08);
  }}
  .sq {{
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    user-select: none;
  }}
  .sq.light {{
    background:
      linear-gradient(135deg, rgba(255,255,255,.12), transparent 32%, rgba(130,75,32,.08)),
      repeating-linear-gradient(90deg, rgba(120,72,32,.08) 0 2px, transparent 2px 11px),
      var(--wood-light);
  }}
  .sq.dark {{
    background:
      linear-gradient(135deg, rgba(255,255,255,.08), transparent 35%, rgba(0,0,0,.08)),
      repeating-linear-gradient(90deg, rgba(255,235,190,.07) 0 2px, transparent 2px 12px),
      var(--wood-dark);
  }}
  .sq.from::after, .sq.to::after {{
    content: "";
    position: absolute;
    inset: 8%;
    border-radius: 50%;
    background: rgba(242, 201, 76, .38);
    border: 2px solid rgba(242, 201, 76, .78);
  }}
  .sq.best-from::before, .sq.best-to::before {{
    content: "";
    position: absolute;
    inset: 13%;
    border-radius: 12px;
    background: rgba(49, 209, 255, .24);
    border: 3px solid rgba(49, 209, 255, .9);
    z-index: 1;
  }}
  .sq.best-to::before {{
    inset: 9%;
    border-radius: 50%;
    background: rgba(49, 209, 255, .36);
  }}
  .best-label {{
    margin-top: 8px;
    color: #31d1ff;
    font-size: 13px;
    font-weight: 700;
  }}
  .piece {{
    position: relative;
    z-index: 2;
    width: 87%;
    height: 87%;
    display: grid;
    place-items: center;
  }}
  .piece-img {{
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 2px 1px rgba(0,0,0,.42));
  }}
  .piece-fallback {{
    font-size: clamp(24px, 5.1vw, 48px);
    filter: drop-shadow(0 2px 1px rgba(0,0,0,.42));
  }}
  .coord {{
    position: absolute;
    z-index: 2;
    font-size: 10px;
    font-weight: 700;
    color: rgba(36, 24, 14, .72);
    text-shadow: 0 1px rgba(255,255,255,.28);
  }}
  .rank {{ top: 3px; left: 4px; }}
  .file {{ right: 4px; bottom: 2px; }}
  .partner-empty {{
    width: 100%;
    aspect-ratio: 1;
    border: 1px dashed #465064;
    border-radius: 4px;
    display: grid;
    place-items: center;
    text-align: center;
    color: var(--muted);
    padding: 22px;
    background:
      linear-gradient(45deg, rgba(230,213,184,.12) 25%, transparent 25%),
      linear-gradient(-45deg, rgba(230,213,184,.12) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, rgba(230,213,184,.12) 75%),
      linear-gradient(-45deg, transparent 75%, rgba(230,213,184,.12) 75%);
    background-size: 64px 64px;
    background-position: 0 0, 0 32px, 32px -32px, -32px 0px;
  }}
  .controls {{
    margin-top: 12px;
    display: grid;
    grid-template-columns: auto auto auto auto 1fr;
    gap: 8px;
    align-items: center;
  }}
  button {{
    border: 1px solid #3a4457;
    background: #202737;
    color: var(--light);
    border-radius: 6px;
    min-height: 36px;
    padding: 0 12px;
    font-weight: 700;
    cursor: pointer;
  }}
  button:hover {{ border-color: var(--accent); }}
  input[type=range] {{
    width: 100%;
    accent-color: var(--accent);
  }}
  .critical {{
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }}
  .crit {{
    min-height: 30px;
    font-size: 12px;
    padding: 0 9px;
    border-color: #41506b;
  }}
  .crit.active {{
    border-color: var(--warn);
    color: var(--warn);
  }}
  .fen {{
    margin-top: 8px;
    color: var(--muted);
    font-family: Consolas, monospace;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}
  .warning {{
    margin-top: 8px;
    color: var(--warn);
    font-size: 12px;
  }}
  @media (max-width: 860px) {{
    .boards {{ grid-template-columns: 1fr; }}
    .matchup {{ grid-template-columns: 1fr; }}
    .versus {{ display: none; }}
    .controls {{ grid-template-columns: repeat(4, auto); }}
    .controls input {{ grid-column: 1 / -1; }}
  }}
</style>
</head>
<body>
<div class="wrap" data-renderer-version="compact-pocket-rails-v1">
  <div class="topline">
    <div class="status">
      <div id="moveTitle" class="move-title"></div>
      <div id="moveMeta" class="meta"></div>
    </div>
  </div>
  <div class="matchup">
    <div class="team">
      <div class="team-label">Your team</div>
      <div id="yourTeam" class="team-names">Unknown + Unknown</div>
    </div>
    <div class="versus">vs</div>
    <div class="team">
      <div class="team-label">Opponents</div>
      <div id="theirTeam" class="team-names">Unknown + Unknown</div>
    </div>
  </div>
  <div class="controls">
    <button id="startBtn" title="Start">|&lt;</button>
    <button id="prevBtn" title="Previous">&lt;</button>
    <button id="playBtn" title="Play or pause">Play</button>
    <button id="nextBtn" title="Next">&gt;</button>
    <input id="plySlider" type="range" min="0" max="0" value="0" />
  </div>
  <div id="criticalButtons" class="critical"></div>
  <div class="boards">
    <section class="board-panel">
      <div class="board-header">
        <span class="board-title">{safe_title}</span>
        <span id="confidence"></span>
      </div>
      <div class="players">
        <div class="player-card">
          <div class="player-color">White</div>
          <div id="mainWhiteName" class="player-name">Unknown</div>
          <span id="mainWhiteRole" class="player-role"></span>
        </div>
        <div class="player-card">
          <div class="player-color">Black</div>
          <div id="mainBlackName" class="player-name">Unknown</div>
          <span id="mainBlackRole" class="player-role"></span>
        </div>
      </div>
      <div class="clock-row">
        <div class="clock">White<br><strong id="whiteClock"></strong></div>
        <div class="clock">Black<br><strong id="blackClock"></strong></div>
      </div>
      <div class="board-stage">
        <div id="whitePocketRail" class="pocket-rail"></div>
        <div id="board" class="chessboard"></div>
        <div id="blackPocketRail" class="pocket-rail"></div>
      </div>
      <div id="fen" class="fen"></div>
      <div id="bestMove" class="best-label"></div>
      <div id="warning" class="warning"></div>
    </section>
    <section class="board-panel">
      <div class="board-header">
        <span class="board-title">Partner board</span>
        <span id="partnerMeta">not loaded</span>
      </div>
      <div id="partnerLoaded">
        <div class="players">
          <div class="player-card">
            <div class="player-color">White</div>
            <div id="partnerWhiteName" class="player-name">Unknown</div>
            <span id="partnerWhiteRole" class="player-role"></span>
          </div>
          <div class="player-card">
            <div class="player-color">Black</div>
            <div id="partnerBlackName" class="player-name">Unknown</div>
            <span id="partnerBlackRole" class="player-role"></span>
          </div>
        </div>
        <div class="clock-row">
          <div class="clock">White<br><strong id="partnerWhiteClock"></strong></div>
          <div class="clock">Black<br><strong id="partnerBlackClock"></strong></div>
        </div>
        <div class="board-stage">
          <div id="partnerWhitePocketRail" class="pocket-rail"></div>
          <div id="partnerBoard" class="chessboard"></div>
          <div id="partnerBlackPocketRail" class="pocket-rail"></div>
        </div>
        <div id="partnerFen" class="fen"></div>
        <div id="partnerWarning" class="warning"></div>
      </div>
      <div id="partnerEmpty" class="partner-empty">
        Import completed PGNs for both boards to load the synchronized partner board.
      </div>
    </section>
  </div>
</div>
<script>
const positions = {positions_json};
const partnerPositions = {partner_positions_json};
const critical = {critical_json};
const engineSuggestions = {engine_suggestions_json};
const playerLabels = {player_labels_json};
const orientation = "{orientation}";
const partnerOrientation = orientation === "white" ? "black" : "white";
let index = Math.min({initial_ply}, Math.max(0, positions.length - 1));
let timer = null;

const pieceMap = {_json_for_script(PIECES)};
const pieceThemeBase = "https://www.chess.com/chess-themes/pieces/neo/150/";
const boardEl = document.getElementById("board");
const partnerBoardEl = document.getElementById("partnerBoard");
const slider = document.getElementById("plySlider");
slider.max = Math.max(0, positions.length - 1);

function setPlayer(cardNameId, cardRoleId, name, role) {{
  const nameEl = document.getElementById(cardNameId);
  const roleEl = document.getElementById(cardRoleId);
  if (!nameEl || !roleEl) return;
  nameEl.textContent = name || "Unknown";
  roleEl.textContent = role || "";
  roleEl.style.display = role ? "inline-block" : "none";
}}

function renderPlayers() {{
  const yourTeam = document.getElementById("yourTeam");
  const theirTeam = document.getElementById("theirTeam");
  if (yourTeam) yourTeam.textContent = (playerLabels.user || "Unknown") + " + " + (playerLabels.partner || "Unknown");
  if (theirTeam) theirTeam.textContent = (playerLabels.opponent || "Unknown") + " + " + (playerLabels.opponent_partner || "Unknown");
  setPlayer("mainWhiteName", "mainWhiteRole", playerLabels.main_white, playerLabels.main_white_role);
  setPlayer("mainBlackName", "mainBlackRole", playerLabels.main_black, playerLabels.main_black_role);
  setPlayer("partnerWhiteName", "partnerWhiteRole", playerLabels.partner_white, playerLabels.partner_white_role);
  setPlayer("partnerBlackName", "partnerBlackRole", playerLabels.partner_black, playerLabels.partner_black_role);
}}

function pieceCode(piece) {{
  if (!piece) return "";
  const color = piece === piece.toUpperCase() ? "w" : "b";
  return color + piece.toLowerCase();
}}

function pieceImage(piece) {{
  return pieceThemeBase + pieceCode(piece) + ".png";
}}

function makePieceElement(piece, extraClass) {{
  const wrap = document.createElement("span");
  wrap.className = extraClass || "piece";
  const img = document.createElement("img");
  img.className = extraClass === "piece" ? "piece-img" : "";
  img.src = pieceImage(piece);
  img.alt = piece;
  img.draggable = false;
  img.onerror = () => {{
    const fallback = document.createElement("span");
    fallback.className = "piece-fallback";
    fallback.textContent = pieceMap[piece] || piece;
    wrap.replaceChildren(fallback);
  }};
  wrap.appendChild(img);
  return wrap;
}}

function pocketCounts(text, color) {{
  const counts = {{}};
  const chars = String(text || "").replace(/-/g, "").split("");
  chars.forEach((piece) => {{
    if (!piece) return;
    const normalized = color === "white" ? piece.toUpperCase() : piece.toLowerCase();
    counts[normalized] = (counts[normalized] || 0) + 1;
  }});
  const order = color === "white" ? ["Q","R","B","N","P"] : ["q","r","b","n","p"];
  return order.filter((piece) => counts[piece]).map((piece) => [piece, counts[piece]]);
}}

function renderPocketRail(targetId, text, color) {{
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = "";
  const label = document.createElement("div");
  label.className = "rail-label";
  label.textContent = color === "white" ? "W" : "B";
  target.appendChild(label);
  const entries = pocketCounts(text, color);
  if (!entries.length) {{
    const empty = document.createElement("div");
    empty.className = "rail-label";
    empty.textContent = "-";
    target.appendChild(empty);
    return;
  }}
  entries.forEach(([piece, count]) => {{
    const slot = makePieceElement(piece, "rail-piece");
    if (count > 1) {{
      const badge = document.createElement("span");
      badge.className = "pocket-count";
      badge.textContent = count;
      slot.appendChild(badge);
    }}
    target.appendChild(slot);
  }});
}}

function squareName(row, col, boardOrientation) {{
  const files = boardOrientation === "white" ? ["a","b","c","d","e","f","g","h"] : ["h","g","f","e","d","c","b","a"];
  const ranks = boardOrientation === "white" ? ["8","7","6","5","4","3","2","1"] : ["1","2","3","4","5","6","7","8"];
  return files[col] + ranks[row];
}}

function boardPiece(position, row, col, boardOrientation) {{
  if (boardOrientation === "white") return position.board[row][col];
  return position.board[7 - row][7 - col];
}}

function suggestionForPly(ply) {{
  return engineSuggestions.find((item) => Number(item.ply) === Number(ply)) || null;
}}

function bestMoveSquares(bestmove) {{
  if (!bestmove) return {{ from: null, to: null }};
  const text = String(bestmove);
  if (text.includes("@")) {{
    const parts = text.split("@");
    return {{ from: null, to: parts[1] || null }};
  }}
  if (text.length >= 4) {{
    return {{ from: text.slice(0, 2), to: text.slice(2, 4) }};
  }}
  return {{ from: null, to: null }};
}}

function renderBoard(target, position, boardOrientation) {{
  target.innerHTML = "";
  const suggestion = target === boardEl ? suggestionForPly(position.ply) : null;
  const best = bestMoveSquares(suggestion && suggestion.bestmove);
  for (let row = 0; row < 8; row++) {{
    for (let col = 0; col < 8; col++) {{
      const square = squareName(row, col, boardOrientation);
      const piece = boardPiece(position, row, col, boardOrientation);
      const sq = document.createElement("div");
      sq.className = "sq " + (((row + col) % 2 === 0) ? "light" : "dark");
      if (square === position.from_square) sq.classList.add("from");
      if (square === position.to_square) sq.classList.add("to");
      if (square === best.from) sq.classList.add("best-from");
      if (square === best.to) sq.classList.add("best-to");
      if (piece) {{
        sq.appendChild(makePieceElement(piece, "piece"));
      }}
      if (col === 0) {{
        const rank = document.createElement("span");
        rank.className = "coord rank";
        rank.textContent = square[1];
        sq.appendChild(rank);
      }}
      if (row === 7) {{
        const file = document.createElement("span");
        file.className = "coord file";
        file.textContent = square[0];
        sq.appendChild(file);
      }}
      target.appendChild(sq);
    }}
  }}
}}

function renderPartner() {{
  const hasPartner = partnerPositions.length > 1;
  document.getElementById("partnerLoaded").style.display = hasPartner ? "block" : "none";
  document.getElementById("partnerEmpty").style.display = hasPartner ? "none" : "grid";
  if (!hasPartner) {{
    document.getElementById("partnerMeta").textContent = "not loaded";
    return;
  }}
  const currentMain = positions[index] || positions[0];
  const syncedIndex = currentMain && currentMain.partner_index !== null && currentMain.partner_index !== undefined
    ? Number(currentMain.partner_index)
    : index;
  const partnerIndex = Math.max(0, Math.min(syncedIndex, partnerPositions.length - 1));
  const position = partnerPositions[partnerIndex];
  const mainElapsed = currentMain && currentMain.elapsed_seconds !== null && currentMain.elapsed_seconds !== undefined
    ? " · synced " + Math.round(currentMain.elapsed_seconds) + "s"
    : "";
  document.getElementById("partnerMeta").textContent = "Ply " + position.ply + " / " + (partnerPositions.length - 1) + mainElapsed;
  renderPocketRail("partnerWhitePocketRail", position.white_pocket, "white");
  renderPocketRail("partnerBlackPocketRail", position.black_pocket, "black");
  document.getElementById("partnerWhiteClock").textContent = position.white_clock || "-";
  document.getElementById("partnerBlackClock").textContent = position.black_clock || "-";
  document.getElementById("partnerFen").textContent = position.variant_fen || position.fen || "";
  document.getElementById("partnerWarning").textContent = position.warning || "";
  renderBoard(partnerBoardEl, position, partnerOrientation);
}}

function renderCriticalButtons() {{
  const wrap = document.getElementById("criticalButtons");
  wrap.innerHTML = "";
  critical.forEach((item) => {{
    const btn = document.createElement("button");
    btn.className = "crit" + (item.ply === index ? " active" : "");
    btn.textContent = item.ply + " · " + item.move;
    btn.title = item.reason;
    btn.onclick = () => {{ index = item.ply; render(); }};
    wrap.appendChild(btn);
  }});
}}

function render() {{
  renderPlayers();
  const position = positions[index] || positions[0];
  slider.value = index;
  document.getElementById("moveTitle").textContent = position.label;
  document.getElementById("moveMeta").textContent = "Ply " + position.ply + " / " + (positions.length - 1) + " · " + position.side_to_move + " to move";
  document.getElementById("confidence").textContent = "confidence: " + position.confidence;
  renderPocketRail("whitePocketRail", position.white_pocket, "white");
  renderPocketRail("blackPocketRail", position.black_pocket, "black");
  document.getElementById("whiteClock").textContent = position.white_clock || "-";
  document.getElementById("blackClock").textContent = position.black_clock || "-";
  document.getElementById("fen").textContent = position.variant_fen || position.fen || "";
  const suggestion = suggestionForPly(position.ply);
  document.getElementById("bestMove").textContent = suggestion ? ("Fairy-Stockfish bestmove: " + suggestion.bestmove) : "";
  document.getElementById("warning").textContent = position.warning || "";
  renderBoard(boardEl, position, orientation);
  renderPartner();
  renderCriticalButtons();
}}

function stop() {{
  if (timer) clearInterval(timer);
  timer = null;
  document.getElementById("playBtn").textContent = "Play";
}}

document.getElementById("startBtn").onclick = () => {{ stop(); index = 0; render(); }};
document.getElementById("prevBtn").onclick = () => {{ stop(); index = Math.max(0, index - 1); render(); }};
document.getElementById("nextBtn").onclick = () => {{ stop(); index = Math.min(positions.length - 1, index + 1); render(); }};
document.getElementById("playBtn").onclick = () => {{
  if (timer) {{ stop(); return; }}
  document.getElementById("playBtn").textContent = "Pause";
  timer = setInterval(() => {{
    if (index >= positions.length - 1) {{ stop(); return; }}
    index += 1;
    render();
  }}, 650);
}};
slider.oninput = (event) => {{ stop(); index = Number(event.target.value); render(); }};

render();
</script>
</body>
</html>
"""
