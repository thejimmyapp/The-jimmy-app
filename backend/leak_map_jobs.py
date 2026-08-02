from __future__ import annotations

import asyncio
from dataclasses import asdict

from backend.config import Settings
from backend.job_control import BoundedJobRegistry
from backend.schemas import LeakMapAnalysisRequest
from backend.services import GameService
from thejimmyapp.phase4 import BatchAnalysisResult, analyze_recent_games_for_mistakes


class LeakMapJobs:
    def __init__(self, settings: Settings, games: GameService) -> None:
        self.settings = settings
        self.games = games
        self.registry = BoundedJobRegistry(
            max_active=settings.leak_map_max_active_jobs,
            max_records=settings.leak_map_max_job_records,
            ttl_seconds=settings.compute_job_ttl_seconds,
        )
        self.semaphore = asyncio.Semaphore(1)

    async def submit(self, request: LeakMapAnalysisRequest) -> str:
        job_id = self.registry.reserve({
            "status": "queued",
            "stage": "Waiting for Fairy-Stockfish",
            "username": request.username,
            "processed": 0,
            "total": request.game_limit,
        })
        asyncio.create_task(self._run(job_id, request))
        return job_id

    async def _run(self, job_id: str, request: LeakMapAnalysisRequest) -> None:
        async with self.semaphore:
            try:
                self._update(job_id, "running", "Finding unanalyzed two-board games")
                result = await asyncio.to_thread(
                    analyze_recent_games_for_mistakes,
                    db=self.games.db,
                    username=request.username,
                    engine_path=self.settings.fairy_stockfish_path,
                    engine_depth=self.settings.engine_depth,
                    game_limit=request.game_limit,
                    max_positions_per_game=request.max_positions_per_game,
                    only_two_board=True,
                    only_unanalyzed=True,
                    selection="recent",
                    progress_callback=lambda processed, total, current: self._progress(
                        job_id, processed, total, current
                    ),
                )
                self.registry.replace(job_id, {
                    "status": "completed",
                    "stage": "Leak map updated",
                    "username": request.username,
                    "processed": result.games_seen,
                    "total": result.games_seen,
                    "result": asdict(result),
                })
            except Exception as exc:
                self.registry.update(
                    job_id,
                    status="failed",
                    stage="Analysis failed",
                    error=str(exc),
                )

    def _progress(self, job_id: str, processed: int, total: int, result: BatchAnalysisResult) -> None:
        self.registry.update(
            job_id,
            status="running",
            stage=f"Analyzing game {processed} of {total}",
            processed=processed,
            total=total,
            result=asdict(result),
        )

    def _update(self, job_id: str, status: str, stage: str) -> None:
        self.registry.update(job_id, status=status, stage=stage)

    def get(self, job_id: str) -> dict[str, object] | None:
        return self.registry.get(job_id)
