from __future__ import annotations

import asyncio
from dataclasses import asdict
from typing import Any
from uuid import uuid4

from backend.coach import prepare_coach_context
from backend.config import Settings
from backend.qwen_runtime import QwenRuntime
from backend.schemas import CoachEngineSuggestion, CoachPrepareRequest
from backend.services import GameService
from thejimmyapp.engine import EngineConfig, FairyStockfishEngine


class CoachJobs:
    def __init__(self, settings: Settings, games: GameService, qwen: QwenRuntime) -> None:
        self.settings = settings
        self.games = games
        self.qwen = qwen
        self.jobs: dict[str, dict[str, object]] = {}
        self.semaphore = asyncio.Semaphore(1)

    async def submit(self, request: CoachPrepareRequest) -> str:
        job_id = str(uuid4())
        self.jobs[job_id] = {
            "status": "queued",
            "stage": "Waiting for the coaching pipeline",
            "game_id": request.game_id,
        }
        asyncio.create_task(self._run(job_id, request))
        return job_id

    async def _run(self, job_id: str, request: CoachPrepareRequest) -> None:
        async with self.semaphore:
            try:
                self._update(job_id, "running", "Validating both boards with Fairy-Stockfish")
                suggestions = await self._engine_suggestions(request)
                validated_request = request.model_copy(update={"engine_suggestions": suggestions})
                self._update(job_id, "running", "Calculating transfers, pockets and partner danger")
                prepared = await asyncio.to_thread(prepare_coach_context, validated_request, self.games)
                self._update(job_id, "running", "Qwen is writing the coaching explanation")
                try:
                    explanation = await self.qwen.explain(str(prepared["prompt"]))
                    qwen_error = None
                except Exception as exc:
                    explanation = None
                    qwen_error = str(exc)
                self.jobs[job_id] = {
                    "status": "completed",
                    "stage": "Review ready" if explanation else "Validated review ready without Qwen",
                    "result": {
                        "explanation": explanation,
                        "qwen_error": qwen_error,
                        "prepared": prepared,
                        "model": self.qwen.status(),
                    },
                }
            except Exception as exc:
                self.jobs[job_id] = {"status": "failed", "stage": "Pipeline failed", "error": str(exc)}

    async def _engine_suggestions(self, request: CoachPrepareRequest) -> list[CoachEngineSuggestion]:
        suggestions: list[CoachEngineSuggestion] = []
        for board_id, board in (("A", request.board_a), ("B", request.board_b)):
            if board is None:
                continue
            config = EngineConfig(
                path=self.settings.fairy_stockfish_path,
                depth=self.settings.engine_depth,
                timeout_seconds=self.settings.engine_timeout_seconds,
            )
            result = await asyncio.wait_for(
                asyncio.to_thread(self._analyze, board.variant_fen, config),
                timeout=self.settings.engine_timeout_seconds + 2,
            )
            suggestions.append(
                CoachEngineSuggestion(
                    board=board_id,
                    bestmove=result.get("bestmove"),
                    score_cp=result.get("score_cp"),
                    mate_in=result.get("mate_in"),
                    depth=result.get("depth"),
                    pv=list(result.get("pv") or [])[:12],
                )
            )
        if not suggestions:
            raise RuntimeError("No board position is available for Fairy-Stockfish")
        return suggestions

    @staticmethod
    def _analyze(fen: str, config: EngineConfig) -> dict[str, Any]:
        with FairyStockfishEngine(config) as engine:
            return asdict(engine.analyze_fen(fen))

    def _update(self, job_id: str, status: str, stage: str) -> None:
        self.jobs[job_id] = {**self.jobs.get(job_id, {}), "status": status, "stage": stage}

    def get(self, job_id: str) -> dict[str, object] | None:
        return self.jobs.get(job_id)
