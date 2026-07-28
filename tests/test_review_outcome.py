from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace

from backend.services import AnalysisJobs, _game_outcome
from thejimmyapp.pgn_parser import MoveRecord


PLAYERS = {
    "board_a_white": "WinnerA",
    "board_a_black": "LoserA",
    "board_b_white": "WinnerB",
    "board_b_black": "LoserB",
}


def move(number: int, color: str = "white", mate: bool = False) -> MoveRecord:
    return MoveRecord(ply=number * 2 - (1 if color == "white" else 0), move_number=number, color=color, san="Qh7#" if mate else "e4", is_mate=mate)


def test_outcome_names_checkmated_player_and_owns_missing_board_context() -> None:
    outcome = _game_outcome(
        {"result": "win", "username": "WinnerA", "opponent": "LoserA"},
        {"white": {"username": "WinnerA", "rating": 2100, "result": "win"}, "black": {"username": "LoserA", "rating": 2050, "result": "checkmated"}},
        PLAYERS,
        [move(27, "white", mate=True)],
        [],
    )

    assert outcome["summary"] == "LoserA was checkmated on Board A on move 27."
    assert outcome["detail"] == "High/low board unknown — second-board data is unavailable."


def test_outcome_calls_board_high_only_when_both_board_ratings_support_it() -> None:
    outcome = _game_outcome(
        {"result": "win", "username": "WinnerA", "opponent": "LoserA"},
        {
            "white": {"rating": 2200, "result": "win"},
            "black": {"rating": 2150, "result": "checkmated"},
            "bughousePartnerPlayer1Rating": 1900,
            "bughousePartnerPlayer2Rating": 1850,
        },
        PLAYERS,
        [move(27, "white", mate=True)],
        [move(26, "black")],
    )

    assert outcome["board_role"] == "high"
    assert outcome["summary"] == "LoserA was checkmated on the high board on move 27."


def test_analysis_job_uses_only_the_stored_completed_game_position() -> None:
    analyzed: list[str] = []
    settings = SimpleNamespace(fairy_stockfish_path=Path("unused"), engine_timeout_seconds=1.0)
    fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR[] b KQkq - 0 1"
    games = SimpleNamespace(snapshot=lambda *_: {"board_a": {"variant_fen": fen}, "board_b": None})
    jobs = AnalysisJobs(settings, games)
    jobs.jobs["job"] = {"status": "queued", "engine": "Fairy-Stockfish", "board": "A", "global_ply": 8, "depth": 10}
    jobs._analyze = lambda fen, _config: analyzed.append(fen) or {"bestmove": "e2e4", "depth": 10}  # type: ignore[method-assign]

    asyncio.run(jobs._run("job", 1, 8, "A", 10))

    assert analyzed == [fen]
    assert jobs.jobs["job"]["status"] == "completed"
    assert jobs.jobs["job"]["result"] == {"bestmove": "e2e4", "depth": 10}
