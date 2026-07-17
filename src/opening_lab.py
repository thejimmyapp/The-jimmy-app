from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from src.analyzer import _analyze_with_cache, _estimated_loss
from src.board_renderer import build_bughouse_pair_positions, build_replay_positions
from src.db import Database
from src.engine import EngineConfig, FairyStockfishEngine
from src.pgn_parser import MoveRecord, parse_game_data, parse_partner_tcn


@dataclass(slots=True)
class OpeningBatchResult:
    games_seen: int = 0
    games_with_moves: int = 0
    analyzed_moves: int = 0
    skipped_games: int = 0


def analyze_opening_batch(
    db: Database,
    username: str,
    engine_path: Path,
    engine_depth: int,
    game_limit: int = 20,
    opening_plies: int = 16,
    only_two_board: bool = True,
    only_unanalyzed: bool = True,
    selection: str = "recent",
) -> OpeningBatchResult:
    config = EngineConfig(path=engine_path, depth=engine_depth)
    games = db.list_games_for_opening_analysis(
        username=username,
        limit=game_limit,
        depth=engine_depth,
        only_unanalyzed=only_unanalyzed,
        only_two_board=only_two_board,
        selection=selection,
    )
    result = OpeningBatchResult(games_seen=len(games))
    with FairyStockfishEngine(config) as engine:
        for game in games:
            pgn = str(game.get("pgn") or "")
            raw_json = str(game.get("raw_json") or "")
            parsed = parse_game_data(pgn, raw_json)
            if not parsed.moves:
                result.skipped_games += 1
                db.replace_opening_move_analysis(int(game["id"]), engine_depth, [])
                continue
            result.games_with_moves += 1
            rows = _analyze_game_opening(
                db=db,
                engine=engine,
                config=config,
                game=game,
                moves=parsed.moves,
                raw_json=raw_json,
                opening_plies=opening_plies,
            )
            db.replace_opening_move_analysis(int(game["id"]), engine_depth, rows)
            result.analyzed_moves += len(rows)
    return result


def _analyze_game_opening(
    db: Database,
    engine: FairyStockfishEngine,
    config: EngineConfig,
    game: dict[str, object],
    moves: list[MoveRecord],
    raw_json: str,
    opening_plies: int,
) -> list[dict[str, object]]:
    user_color = str(game.get("user_color") or "").lower()
    if user_color not in {"white", "black"}:
        return []

    partner = parse_partner_tcn(raw_json)
    if partner and partner.moves:
        positions, _partner_positions = build_bughouse_pair_positions(moves, partner.moves)
    else:
        positions = build_replay_positions(moves)

    rows: list[dict[str, object]] = []
    for move in moves[:opening_plies]:
        if move.color != user_color:
            continue
        before_idx = max(0, min(move.ply - 1, len(positions) - 1))
        after_idx = max(0, min(move.ply, len(positions) - 1))
        before = positions[before_idx]
        after = positions[after_idx]
        if not before.variant_fen:
            continue
        before_analysis = _analyze_with_cache(db, engine, before.variant_fen, config)
        after_analysis = _analyze_with_cache(db, engine, after.variant_fen, config) if after.variant_fen else None
        loss = _estimated_loss(before_analysis, after_analysis)
        rows.append(
            {
                "username": str(game.get("username") or "").lower(),
                "ply": move.ply,
                "move_number": move.move_number,
                "color": move.color,
                "played_move": move.san,
                "line_key": _line_key(moves, move.ply - 1),
                "line_label": _line_label(moves, move.ply - 1),
                "before_fen": before.variant_fen,
                "after_fen": after.variant_fen,
                "bestmove": before_analysis.bestmove,
                "score_before": before_analysis.score_label,
                "score_after": after_analysis.score_label if after_analysis else "not analyzed",
                "estimated_loss_cp": loss,
                "quality": _quality(move, before_analysis.bestmove, loss),
            }
        )
    return rows


def _quality(move: MoveRecord, bestmove: str | None, loss: int | None) -> str:
    if bestmove and _normalize_move(move.uci or move.san) == _normalize_move(bestmove):
        return "best"
    if loss is None:
        return "unknown"
    if loss <= 35:
        return "good"
    if loss <= 100:
        return "inaccuracy"
    if loss <= 250:
        return "mistake"
    return "blunder"


def _line_key(moves: list[MoveRecord], until_ply: int) -> str:
    if until_ply <= 0:
        return "start"
    return " ".join(_normalize_move(move.san) for move in moves[:until_ply])


def _line_label(moves: list[MoveRecord], until_ply: int) -> str:
    if until_ply <= 0:
        return "Start position"
    return " ".join(move.san for move in moves[:until_ply])


def _normalize_move(move: str) -> str:
    return (
        move.replace("+", "")
        .replace("#", "")
        .replace("=", "")
        .replace("x", "")
        .replace("-", "")
        .lower()
        .strip()
    )
