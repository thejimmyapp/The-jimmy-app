from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from src.analyzer import EngineMomentAnalysis, _analyze_with_cache, analyze_critical_moments, analyze_critical_positions
from src.board_renderer import ReplayPosition, build_bughouse_pair_positions, build_replay_positions
from src.db import Database
from src.engine import EngineAnalysis, EngineConfig, FairyStockfishEngine
from src.pgn_parser import CriticalMoment, MoveRecord, extract_critical_moments, parse_game_data, parse_partner_tcn
from src.tactical_motifs import classify_tactical_motif


MIN_MISTAKE_CP = 75


@dataclass(slots=True)
class BatchAnalysisResult:
    games_seen: int = 0
    games_with_moves: int = 0
    critical_positions: int = 0
    stored_mistakes: int = 0
    skipped_games: int = 0


def analyze_recent_games_for_mistakes(
    db: Database,
    username: str,
    engine_path: Path,
    engine_depth: int,
    game_limit: int = 10,
    max_positions_per_game: int = 8,
    only_two_board: bool = True,
    only_unanalyzed: bool = True,
    selection: str = "recent",
) -> BatchAnalysisResult:
    config = EngineConfig(path=engine_path, depth=engine_depth)
    games = db.list_games_for_mistake_analysis(
        username=username,
        limit=game_limit,
        only_two_board=only_two_board,
        depth=engine_depth,
        only_unanalyzed=only_unanalyzed,
        selection=selection,
    )
    result = BatchAnalysisResult(games_seen=len(games))
    for game in games:
        pgn = str(game.get("pgn") or "")
        raw_json = str(game.get("raw_json") or "")
        parsed = parse_game_data(pgn, raw_json)
        if not parsed.moves:
            result.skipped_games += 1
            db.record_game_analysis_run(
                game_id=int(game["id"]),
                username=username,
                depth=engine_depth,
                max_positions=max_positions_per_game,
                critical_positions=0,
                mistakes_found=0,
                status="skipped",
            )
            continue
        result.games_with_moves += 1
        moments = extract_critical_moments(parsed)
        if not moments:
            db.replace_game_mistakes(int(game["id"]), engine_depth, [])
            db.record_game_analysis_run(
                game_id=int(game["id"]),
                username=username,
                depth=engine_depth,
                max_positions=max_positions_per_game,
                critical_positions=0,
                mistakes_found=0,
                status="complete",
            )
            continue
        selected = moments[:max_positions_per_game]
        moves_by_ply = {move.ply: move for move in parsed.moves}
        main_positions, partner_context = _analysis_positions(raw_json, parsed.moves)
        result.critical_positions += len(selected)
        engine_rows = analyze_critical_positions(
            db=db,
            moments=selected,
            positions=main_positions,
            config=config,
            max_positions=max_positions_per_game,
        )
        user_color = str(game.get("user_color") or "").lower()
        mistakes = []
        with FairyStockfishEngine(config) as engine:
            for moment, row in _align_moments(selected, engine_rows):
                if not (_is_storable_mistake(row) and (not user_color or moment.color == user_color)):
                    continue
                context = partner_context.get(max(0, row.ply - 1))
                partner_analysis = None
                if context and context.variant_fen:
                    partner_analysis = _analyze_with_cache(db, engine, context.variant_fen, config)
                mistakes.append(
                    _mistake_record(
                        game,
                        moment,
                        row,
                        moves_by_ply.get(row.ply),
                        context,
                        partner_analysis,
                    )
                )
        db.replace_game_mistakes(int(game["id"]), engine_depth, mistakes)
        db.record_game_analysis_run(
            game_id=int(game["id"]),
            username=username,
            depth=engine_depth,
            max_positions=max_positions_per_game,
            critical_positions=len(selected),
            mistakes_found=len(mistakes),
            status="complete",
        )
        result.stored_mistakes += len(mistakes)
    return result


def _align_moments(
    moments: list[CriticalMoment],
    rows: list[EngineMomentAnalysis],
) -> list[tuple[CriticalMoment, EngineMomentAnalysis]]:
    by_ply = {row.ply: row for row in rows}
    return [(moment, by_ply[moment.ply]) for moment in moments if moment.ply in by_ply]


def _is_storable_mistake(row: EngineMomentAnalysis) -> bool:
    return row.estimated_loss_cp is not None and row.estimated_loss_cp >= MIN_MISTAKE_CP


def _mistake_record(
    game: dict[str, object],
    moment: CriticalMoment,
    row: EngineMomentAnalysis,
    move_record: MoveRecord | None,
    partner_context: ReplayPosition | None,
    partner_analysis: EngineAnalysis | None,
) -> dict[str, object]:
    loss = int(row.estimated_loss_cp or 0)
    partner_color = _partner_color(str(game.get("user_color") or ""))
    partner_danger = _partner_danger(partner_context, partner_analysis, partner_color)
    partner_explanation = _partner_danger_explanation(row, partner_danger)
    category = classify_bughouse_category(
        move=row.move,
        bestmove=row.bestmove,
        reason=row.reason,
        clock_seconds=move_record.clock_seconds if move_record else None,
        time_spent_seconds=move_record.time_spent_seconds if move_record else None,
        partner_danger=partner_danger,
    )
    return {
        "username": str(game.get("username") or "").lower(),
        "ply": row.ply,
        "move": row.move,
        "side": moment.color,
        "reason": row.reason,
        "category": category,
        "tactical_motif": classify_tactical_motif(
            before_fen=row.before_fen,
            bestmove=row.bestmove,
            played_move=row.move,
            reason=row.reason,
            category=category,
        ),
        "severity": _severity(loss),
        "estimated_loss_cp": loss,
        "bestmove": row.bestmove,
        "score_before": row.score_before,
        "score_after": row.score_after,
        "depth": row.depth,
        "confidence": row.confidence,
        "note": row.note,
        "before_fen": row.before_fen,
        "after_fen": row.after_fen,
        "clock_seconds": move_record.clock_seconds if move_record else None,
        "time_spent_seconds": move_record.time_spent_seconds if move_record else None,
        "partner_ply": partner_context.ply if partner_context else None,
        "partner_fen": partner_context.variant_fen if partner_context else None,
        "partner_score_before": partner_analysis.score_label if partner_analysis else None,
        "partner_mate_in": partner_analysis.mate_in if partner_analysis else None,
        "partner_danger": partner_explanation,
    }


def _severity(loss: int) -> str:
    if loss >= 300:
        return "blunder"
    if loss >= 150:
        return "mistake"
    return "inaccuracy"


def classify_bughouse_category(
    move: str | None,
    bestmove: str | None,
    reason: str | None,
    clock_seconds: float | None = None,
    time_spent_seconds: float | None = None,
    partner_danger: str | None = None,
) -> str:
    played = str(move or "")
    best = str(bestmove or "")
    text = f"{played} {best} {reason or ''}".lower()
    played_drop = "@" in played
    best_drop = "@" in best

    if partner_danger:
        return "ignored partner danger"
    if clock_seconds is not None and clock_seconds <= 20:
        return "tempo loss"
    if time_spent_seconds is not None and time_spent_seconds >= 12:
        return "tempo loss"
    if "mate" in text:
        return "king net"
    if "check" in text and (played_drop or best_drop):
        return "bad defensive drop" if played_drop else "missed defensive drop"
    if played_drop and best_drop:
        return "wrong drop square"
    if played_drop and not best_drop:
        return "bad defensive drop"
    if best_drop and not played_drop:
        return "missed attacking drop"
    if "capture" in text or "trade" in text:
        return "feeding material"
    if "partner" in text:
        return "ignored partner danger"
    if "check" in text:
        return "king net"
    return "tactical miss"


def _partner_contexts(raw_json: str, main_moves: list[MoveRecord]) -> dict[int, ReplayPosition]:
    partner = parse_partner_tcn(raw_json)
    if not partner or not partner.moves:
        return {}
    main_positions, partner_positions = build_bughouse_pair_positions(main_moves, partner.moves)
    contexts: dict[int, ReplayPosition] = {}
    for position in main_positions:
        if position.partner_index is None:
            continue
        idx = max(0, min(position.partner_index, len(partner_positions) - 1))
        contexts[position.ply] = partner_positions[idx]
    return contexts


def _analysis_positions(raw_json: str, main_moves: list[MoveRecord]) -> tuple[list[ReplayPosition], dict[int, ReplayPosition]]:
    partner = parse_partner_tcn(raw_json)
    if not partner or not partner.moves:
        return build_replay_positions(main_moves), {}
    main_positions, partner_positions = build_bughouse_pair_positions(main_moves, partner.moves)
    contexts: dict[int, ReplayPosition] = {}
    for position in main_positions:
        if position.partner_index is None:
            continue
        idx = max(0, min(position.partner_index, len(partner_positions) - 1))
        contexts[position.ply] = partner_positions[idx]
    return main_positions, contexts


def _partner_color(user_color: str) -> str:
    return "black" if user_color.lower() == "white" else "white"


def _partner_danger(
    context: ReplayPosition | None,
    analysis: EngineAnalysis | None,
    partner_color: str,
) -> str | None:
    if context is None or analysis is None:
        return None
    partner_cp = _score_from_partner_pov(context.variant_fen, analysis, partner_color)
    if partner_cp is None:
        return None
    if partner_cp <= -100000:
        return "partner facing mate"
    if partner_cp <= -300:
        return f"partner under pressure ({partner_cp} cp)"
    return None


def _partner_danger_explanation(row: EngineMomentAnalysis, danger: str | None) -> str | None:
    if not danger:
        return None
    best = row.bestmove or ""
    if "mate" in danger:
        return "Your partner was facing a mate threat on the synced board."
    if "@" in best:
        return f"Your partner was under pressure; the engine wanted a drop here ({best})."
    if "x" in row.move or "capture" in row.reason.lower():
        return "Your move happened while partner was under pressure; captures here may feed the other board."
    return f"Your partner was under pressure on the synced board: {danger}."


def _score_from_partner_pov(
    fen: str,
    analysis: EngineAnalysis,
    partner_color: str,
) -> int | None:
    side_to_move = _fen_side_to_move(fen)
    if side_to_move is None:
        return None
    if analysis.mate_in is not None:
        side_to_move_cp = 100000 if analysis.mate_in > 0 else -100000
    elif analysis.score_cp is not None:
        side_to_move_cp = analysis.score_cp
    else:
        return None
    white_cp = side_to_move_cp if side_to_move == "white" else -side_to_move_cp
    return white_cp if partner_color == "white" else -white_cp


def _fen_side_to_move(fen: str) -> str | None:
    parts = fen.split()
    if len(parts) < 2:
        return None
    if parts[1] == "w":
        return "white"
    if parts[1] == "b":
        return "black"
    return None
