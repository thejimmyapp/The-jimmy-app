from __future__ import annotations

import json
from dataclasses import asdict, dataclass

from src.bughouse_reconstructor import reconstruct_main_board
from src.board_renderer import ReplayPosition
from src.db import Database
from src.engine import EngineAnalysis, EngineConfig, FairyStockfishEngine
from src.pgn_parser import CriticalMoment, ParsedGame


@dataclass(slots=True)
class EngineMomentAnalysis:
    ply: int
    move: str
    reason: str
    before_fen: str | None
    after_fen: str | None
    bestmove: str | None
    score_before: str
    score_after: str
    estimated_loss_cp: int | None
    depth: int | None
    pv: str
    confidence: str
    note: str


def analyze_critical_moments(
    db: Database,
    parsed: ParsedGame,
    moments: list[CriticalMoment],
    config: EngineConfig,
    max_positions: int = 12,
) -> list[EngineMomentAnalysis]:
    results: list[EngineMomentAnalysis] = []
    selected = moments[:max_positions]
    with FairyStockfishEngine(config) as engine:
        for moment in selected:
            before = reconstruct_main_board(parsed.moves, until_ply=max(0, moment.ply - 1))
            after = reconstruct_main_board(parsed.moves, until_ply=moment.ply)

            if before.warning and before.ply < max(0, moment.ply - 1):
                results.append(_skipped(moment, before.fen, None, before.warning))
                continue
            before_fen = before.variant_fen or before.fen
            after_fen = after.variant_fen or after.fen

            if not before_fen:
                results.append(_skipped(moment, None, None, before.warning or "No FEN available before this move."))
                continue

            before_analysis = _analyze_with_cache(db, engine, before_fen, config)
            after_analysis: EngineAnalysis | None = None
            after_note = ""
            if after_fen and not after.failed_moves:
                after_analysis = _analyze_with_cache(db, engine, after_fen, config)
            if after.warning:
                after_note = f"After-position note: {after.warning}"

            estimated_loss = _estimated_loss(before_analysis, after_analysis)
            note_parts = ["Engine analysis is tactical only; partner board and pockets may be missing."]
            if not before_analysis.variant_supported:
                note_parts.append("Engine did not expose UCI_Variant; analyzed as the engine default variant.")
            if after_note:
                note_parts.append(after_note)
            if before.inferred_drops or after.inferred_drops:
                note_parts.append("Pocket data includes inferred pieces; treat as lower confidence.")

            results.append(
                EngineMomentAnalysis(
                    ply=moment.ply,
                    move=moment.move,
                    reason=moment.reason,
                    before_fen=before_fen,
                    after_fen=after_fen if after_fen and not after.failed_moves else None,
                    bestmove=before_analysis.bestmove,
                    score_before=before_analysis.score_label,
                    score_after=after_analysis.score_label if after_analysis else "not analyzed",
                    estimated_loss_cp=estimated_loss,
                    depth=before_analysis.depth,
                    pv=" ".join(before_analysis.pv[:8]),
                    confidence="medium" if before_analysis.variant_supported and before.confidence != "low" else "low",
                    note=" ".join(note_parts),
                )
            )
    return results


def analyze_critical_positions(
    db: Database,
    moments: list[CriticalMoment],
    positions: list[ReplayPosition],
    config: EngineConfig,
    max_positions: int = 12,
) -> list[EngineMomentAnalysis]:
    results: list[EngineMomentAnalysis] = []
    selected = moments[:max_positions]
    with FairyStockfishEngine(config) as engine:
        for moment in selected:
            before_idx = max(0, min(moment.ply - 1, len(positions) - 1))
            after_idx = max(0, min(moment.ply, len(positions) - 1))
            before = positions[before_idx]
            after = positions[after_idx]
            before_fen = before.variant_fen or before.fen
            after_fen = after.variant_fen or after.fen
            if not before_fen:
                results.append(_skipped(moment, None, None, "No FEN available before this move."))
                continue

            before_analysis = _analyze_with_cache(db, engine, before_fen, config)
            after_analysis = _analyze_with_cache(db, engine, after_fen, config) if after_fen else None
            estimated_loss = _estimated_loss(before_analysis, after_analysis)
            note_parts = ["Engine analysis uses synced two-board Bughouse reconstruction when available."]
            if before.warning:
                note_parts.append(f"Before-position note: {before.warning}")
            if after.warning:
                note_parts.append(f"After-position note: {after.warning}")
            if not before_analysis.variant_supported:
                note_parts.append("Engine did not expose UCI_Variant; analyzed as the engine default variant.")

            results.append(
                EngineMomentAnalysis(
                    ply=moment.ply,
                    move=moment.move,
                    reason=moment.reason,
                    before_fen=before_fen,
                    after_fen=after_fen,
                    bestmove=before_analysis.bestmove,
                    score_before=before_analysis.score_label,
                    score_after=after_analysis.score_label if after_analysis else "not analyzed",
                    estimated_loss_cp=estimated_loss,
                    depth=before_analysis.depth,
                    pv=" ".join(before_analysis.pv[:8]),
                    confidence="medium" if before_analysis.variant_supported and before.confidence != "low" else "low",
                    note=" ".join(note_parts),
                )
            )
    return results


def _analyze_with_cache(db: Database, engine: FairyStockfishEngine, fen: str, config: EngineConfig) -> EngineAnalysis:
    cache_key = f"{config.path}|{config.variant}|depth={config.depth}|{fen}"
    cached = db.get_engine_cache(cache_key)
    if cached:
        payload = json.loads(cached)
        return EngineAnalysis(**payload)

    analysis = engine.analyze_fen(fen)
    db.set_engine_cache(cache_key, json.dumps(asdict(analysis), ensure_ascii=False))
    return analysis


def _estimated_loss(before: EngineAnalysis, after: EngineAnalysis | None) -> int | None:
    if after is None:
        return None
    if before.score_cp is None or after.score_cp is None:
        return None
    after_from_mover_pov = -after.score_cp
    return before.score_cp - after_from_mover_pov


def _skipped(
    moment: CriticalMoment,
    before_fen: str | None,
    after_fen: str | None,
    note: str,
) -> EngineMomentAnalysis:
    return EngineMomentAnalysis(
        ply=moment.ply,
        move=moment.move,
        reason=moment.reason,
        before_fen=before_fen,
        after_fen=after_fen,
        bestmove=None,
        score_before="not analyzed",
        score_after="not analyzed",
        estimated_loss_cp=None,
        depth=None,
        pv="",
        confidence="low",
        note=note,
    )
