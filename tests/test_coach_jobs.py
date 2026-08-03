from __future__ import annotations

import asyncio
import json
from pathlib import Path
import threading
from types import SimpleNamespace

from backend.coach_jobs import CoachJobs
from backend.schemas import CoachPrepareRequest


START_A = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[] w KQkq - 0 1"
START_B = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[] b KQkq - 0 1"


def _position(fen: str, side: str) -> dict[str, object]:
    return {
        "variant_fen": fen,
        "side_to_move": side,
        "white_pocket": "-",
        "black_pocket": "-",
        "white_clock": "-",
        "black_clock": "-",
        "from_square": None,
        "to_square": None,
    }


class FakeGames:
    def snapshot(self, game_id: int, global_ply: int) -> dict[str, object] | None:
        if game_id != 42:
            return None
        return {
            "global_ply": min(global_ply, 4),
            "board_a": _position(START_A, "White"),
            "board_b": _position(START_B, "Black"),
        }

    def get_game_payload(self, game_id: int) -> dict[str, object] | None:
        snapshot = self.snapshot(game_id, 4)
        if not snapshot:
            return None
        return {
            "game": {"username": "Jimmy", "user_color": "white"},
            "players": {},
            "timeline": [],
            "limitations": ["Clock data unavailable"],
        }


class FakeQwen:
    async def explain(self, _prompt: str, *, fact_ids: tuple[str, ...] = ()) -> str:
        assert "board_a.best_move" in fact_ids
        section = {
            "fact_ids": ["board_a.best_move"],
            "explanation": "The cited engine candidate should anchor the plan.",
        }
        return json.dumps({key: section for key in ("summary", "board_a", "board_b", "team_plan")})

    def status(self) -> dict[str, object]:
        return {"state": "ready"}


def test_coach_job_analyzes_only_server_loaded_snapshots() -> None:
    settings = SimpleNamespace(
        coach_max_active_jobs=2,
        coach_max_job_records=50,
        compute_job_ttl_seconds=900,
        fairy_stockfish_path=Path("fairy-stockfish"),
        engine_depth=10,
        engine_timeout_seconds=1.0,
    )
    manager = CoachJobs(settings, FakeGames(), FakeQwen())
    analyzed: list[str] = []
    both_boards_started = threading.Barrier(2)

    def fake_analyze(fen: str, _config) -> dict[str, object]:
        analyzed.append(fen)
        both_boards_started.wait(timeout=1)
        return {
            "bestmove": "g1f3" if fen == START_A else "g8f6",
            "score_cp": 0,
            "mate_in": None,
            "depth": 10,
            "pv": [],
        }

    manager._analyze = fake_analyze  # type: ignore[method-assign]

    async def run_job() -> dict[str, object]:
        job_id = await manager.submit(CoachPrepareRequest(
            game_id=42,
            global_ply=999,
            question="What should our team play?",
        ))
        for _ in range(40):
            job = manager.get(job_id)
            if job and job["status"] in {"completed", "failed"}:
                return job
            await asyncio.sleep(0.01)
        raise AssertionError("Coach job did not finish")

    job = asyncio.run(run_job())

    assert set(analyzed) == {START_A, START_B}
    assert job["status"] == "completed"
    assert job["result"]["prepared"]["facts"]["global_ply"] == 4
    assert job["result"]["validation"]["status"] == "passed"
