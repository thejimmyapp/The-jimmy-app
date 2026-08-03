from __future__ import annotations

import json
from pathlib import Path
import sys
import time

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.coach_output import validate_and_render_coach_output  # noqa: E402


def facts(*, transfer: bool = False, clocks: bool = True, board_b: bool = True, mate: bool = False) -> dict[str, object]:
    boards = {
        "A": {
            "available": True,
            "side_to_move": "White",
            "best_move": "e4d5" if transfer else "g1f3",
            "score_cp": None if mate else 35,
            "mate_in": 2 if mate else None,
            "depth": 10,
            "white_clock": "0:24" if clocks else None,
            "black_clock": "0:19" if clocks else None,
        },
        "B": {
            "available": board_b,
            "side_to_move": "Black" if board_b else None,
            "best_move": "g8f6" if board_b else None,
            "score_cp": -20 if board_b else None,
            "mate_in": None,
            "depth": 10 if board_b else None,
            "white_clock": "0:31" if board_b and clocks else None,
            "black_clock": "0:28" if board_b and clocks else None,
        },
    }
    missing = []
    if not clocks:
        missing.extend(["Board A white clock", "Board A black clock"])
    if not board_b:
        missing.append("Board B replay data")
    transfers = [{
        "board": "A",
        "move": "e4d5",
        "piece": "knight",
        "partner_impact": "knight added to the black partner pocket on Board B",
    }] if transfer else []
    return {
        "source": "stored completed-game replay",
        "global_ply": 8,
        "boards": boards,
        "transfers": transfers,
        "missing_data": missing,
        "urgency": "critical" if mate else "normal",
        "catalog": {
            "board_a.available": True,
            "board_a.best_move": boards["A"]["best_move"],
            "team.urgency": "critical" if mate else "normal",
        },
    }


def output(explanation: str, fact_id: str = "board_a.available") -> str:
    section = {"fact_ids": [fact_id], "explanation": explanation}
    return json.dumps({key: section for key in ("summary", "board_a", "board_b", "team_plan")})


CASES = (
    ("starting position", facts(), output("Play g1f3 on both boards.")),
    ("capture / transfer", facts(transfer=True), output("Use the invented transfer.", "transfer_99.piece")),
    ("missing clocks", facts(clocks=False), output("There is no time pressure.")),
    ("missing Board B", facts(board_b=False), output("Board B should attack immediately.")),
    ("engine mate signal", facts(mate=True), output("The engine shows mate in 5.")),
)


def main(iterations: int = 10_000) -> None:
    print("| Case | Mean validation latency | Unsafe claim | Deterministic facts |")
    print("|---|---:|---|---|")
    for name, case_facts, raw in CASES:
        started = time.perf_counter()
        result = None
        for _ in range(iterations):
            result = validate_and_render_coach_output({"facts": case_facts}, raw)
        elapsed_ms = (time.perf_counter() - started) * 1000 / iterations
        assert result is not None
        print(
            f"| {name} | {elapsed_ms:.3f} ms | "
            f"{result['validation']['status']} | rendered from stored/engine facts |"
        )


if __name__ == "__main__":
    main()
