from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace

import backend.leak_map_jobs as jobs_module
from backend.leak_map_jobs import LeakMapJobs
from backend.schemas import LeakMapAnalysisRequest
from thejimmyapp.phase4 import BatchAnalysisResult


def test_leak_map_job_reports_progress_and_completion(monkeypatch) -> None:
    calls: dict[str, object] = {}

    def fake_analysis(**kwargs):
        calls.update(kwargs)
        result = BatchAnalysisResult(
            games_seen=2,
            games_with_moves=2,
            critical_positions=5,
            stored_mistakes=3,
        )
        kwargs["progress_callback"](2, 2, result)
        return result

    monkeypatch.setattr(jobs_module, "analyze_recent_games_for_mistakes", fake_analysis)
    settings = SimpleNamespace(
        fairy_stockfish_path=Path("fairy-stockfish"),
        engine_depth=10,
        leak_map_max_active_jobs=1,
        leak_map_max_job_records=25,
        compute_job_ttl_seconds=900,
    )
    games = SimpleNamespace(db=object())
    manager = LeakMapJobs(settings, games)

    async def run_job() -> dict[str, object]:
        job_id = await manager.submit(LeakMapAnalysisRequest(username="Jimmy"))
        for _ in range(20):
            job = manager.get(job_id)
            if job and job["status"] in {"completed", "failed"}:
                return job
            await asyncio.sleep(0.01)
        raise AssertionError("Leak-map job did not finish")

    job = asyncio.run(run_job())
    assert job["status"] == "completed"
    assert job["processed"] == 2
    assert job["result"]["stored_mistakes"] == 3
    assert calls["only_two_board"] is True
    assert calls["only_unanalyzed"] is True
