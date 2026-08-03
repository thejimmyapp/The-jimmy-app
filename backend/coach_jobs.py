from __future__ import annotations

import asyncio
from dataclasses import asdict
from typing import Any

from backend.coach import prepare_coach_context
from backend.coach_output import validate_and_render_coach_output
from backend.config import Settings
from backend.job_control import BoundedJobRegistry
from backend.qwen_runtime import QwenRuntime
from backend.schemas import CoachPrepareRequest
from backend.services import GameService
from thejimmyapp.engine import EngineConfig, FairyStockfishEngine


class CoachJobs:
    def __init__(self, settings: Settings, games: GameService, qwen: QwenRuntime) -> None:
        self.settings = settings
        self.games = games
        self.qwen = qwen
        self.registry = BoundedJobRegistry(
            max_active=settings.coach_max_active_jobs,
            max_records=settings.coach_max_job_records,
            ttl_seconds=settings.compute_job_ttl_seconds,
        )
        self.semaphore = asyncio.Semaphore(1)

    async def submit(self, request: CoachPrepareRequest) -> str:
        job_id = self.registry.reserve({
            "status": "queued",
            "stage": "Waiting for the coaching pipeline",
            "game_id": request.game_id,
            "global_ply": request.global_ply,
        })
        asyncio.create_task(self._run(job_id, request))
        return job_id

    async def _run(self, job_id: str, request: CoachPrepareRequest) -> None:
        async with self.semaphore:
            try:
                self._update(job_id, "running", "Validating both boards with Fairy-Stockfish")
                suggestions = await self._engine_suggestions(request)
                self._update(job_id, "running", "Calculating transfers, pockets and partner danger")
                prepared = await asyncio.to_thread(
                    prepare_coach_context,
                    request,
                    self.games,
                    suggestions,
                )
                self._update(job_id, "running", "Qwen is writing the coaching explanation")
                try:
                    facts = prepared.get("facts") if isinstance(prepared.get("facts"), dict) else {}
                    catalog = facts.get("catalog") if isinstance(facts.get("catalog"), dict) else {}
                    raw_output = await self.qwen.explain(
                        str(prepared["prompt"]),
                        fact_ids=tuple(str(item) for item in catalog),
                    )
                    rendered = validate_and_render_coach_output(prepared, raw_output)
                    explanation = str(rendered["answer"])
                    qwen_commentary = rendered["qwen_commentary"]
                    validation = rendered["validation"]
                    qwen_error = None
                except Exception as exc:
                    rendered = validate_and_render_coach_output(prepared, "")
                    explanation = str(rendered["answer"])
                    qwen_commentary = None
                    validation = rendered["validation"]
                    qwen_error = str(exc)
                self.registry.replace(job_id, {
                    "status": "completed",
                    "stage": "Review ready" if qwen_commentary else "Deterministic review ready",
                    "result": {
                        "explanation": explanation,
                        "qwen_commentary": qwen_commentary,
                        "validation": validation,
                        "qwen_error": qwen_error,
                        "prepared": prepared,
                        "model": self.qwen.status(),
                    },
                })
            except Exception as exc:
                self.registry.replace(
                    job_id,
                    {"status": "failed", "stage": "Pipeline failed", "error": str(exc)},
                )

    async def _engine_suggestions(self, request: CoachPrepareRequest) -> list[dict[str, object]]:
        snapshot = await asyncio.to_thread(self.games.snapshot, request.game_id, request.global_ply)
        if not snapshot:
            raise RuntimeError("Stored replay position is unavailable")

        async def analyze_board(board_id: str, key: str) -> dict[str, object] | None:
            board = snapshot.get(key)
            if not isinstance(board, dict) or not board.get("variant_fen"):
                return None
            config = EngineConfig(
                path=self.settings.fairy_stockfish_path,
                depth=self.settings.engine_depth,
                timeout_seconds=self.settings.engine_timeout_seconds,
            )
            result = await asyncio.wait_for(
                asyncio.to_thread(self._analyze, str(board["variant_fen"]), config),
                timeout=self.settings.engine_timeout_seconds + 2,
            )
            return {
                "board": board_id,
                "bestmove": result.get("bestmove"),
                "score_cp": result.get("score_cp"),
                "mate_in": result.get("mate_in"),
                "depth": result.get("depth"),
                "pv": list(result.get("pv") or [])[:12],
            }

        results = await asyncio.gather(
            analyze_board("A", "board_a"),
            analyze_board("B", "board_b"),
        )
        suggestions = [result for result in results if result is not None]
        if not suggestions:
            raise RuntimeError("No board position is available for Fairy-Stockfish")
        return suggestions

    @staticmethod
    def _analyze(fen: str, config: EngineConfig) -> dict[str, Any]:
        with FairyStockfishEngine(config) as engine:
            return asdict(engine.analyze_fen(fen))

    def _update(self, job_id: str, status: str, stage: str) -> None:
        self.registry.update(job_id, status=status, stage=stage)

    def get(self, job_id: str) -> dict[str, object] | None:
        return self.registry.get(job_id)
