from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha1
from typing import Iterable, Literal

from backend.exploration import apply_exploration_san_move
from backend.schemas import ExplorationSanMoveRequest, PuzzleMove
from thejimmyapp.board_renderer import replay_position_from_variant_fen


BoardName = Literal["A", "B"]


@dataclass(frozen=True, slots=True)
class PuzzleStep:
    board: BoardName
    san: str
    solver: bool


@dataclass(frozen=True, slots=True)
class PuzzleRecord:
    id: str
    title: str
    prompt: str
    boards: tuple[str, str]
    perspective_board: BoardName
    perspective_color: Literal["white", "black"]
    category: str
    rating: int
    tags: tuple[str, ...]
    source: dict[str, str]
    players: dict[str, str]
    solution: tuple[PuzzleStep, ...]

    def public_payload(self) -> dict[str, object]:
        board_a = replay_position_from_variant_fen(self.boards[0], "Puzzle start")
        board_b = replay_position_from_variant_fen(self.boards[1], "Puzzle start")
        return {
            "id": self.id,
            "title": self.title,
            "prompt": self.prompt,
            "boards": list(self.boards),
            "positions": {"board_a": asdict(board_a), "board_b": asdict(board_b)},
            "perspective": {"board": self.perspective_board, "color": self.perspective_color},
            "category": self.category,
            "rating": self.rating,
            "tags": list(self.tags),
            "source": self.source,
            "players": self.players,
        }


RYANTIME_BOARD_A = (
    "1rr5/pp2PpNp/1qkBp2p/1p1pP3/3P4/5N2/P1PB1PPP/"
    "b2QK2R[BQrrqbnnnnppppP] w K - 0 1"
)
RYANTIME_BOARD_B = "5R2/p1pb1k2/2p2bRB/3p4/3P1N2/2N5/PPP2P1P/4R1K1[P] b - - 0 1"


def puzzle_content_id(board_a: str, board_b: str, board: BoardName, color: str) -> str:
    canonical = f"{board_a}|{board_b}|{board}|{color.lower()}"
    return sha1(canonical.encode("utf-8"), usedforsecurity=False).hexdigest()


RYANTIME_PUZZLE_ID = puzzle_content_id(RYANTIME_BOARD_A, RYANTIME_BOARD_B, "A", "white")

RYANTIME_PUZZLE = PuzzleRecord(
    id=RYANTIME_PUZZLE_ID,
    title="RyanTime's forcing promotion",
    prompt="RyanTime to move on Board A. Promote with tempo, then keep every reply forced.",
    boards=(RYANTIME_BOARD_A, RYANTIME_BOARD_B),
    perspective_board="A",
    perspective_color="white",
    category="forcing line",
    rating=1600,
    tags=("real-game", "promotion", "drop-sequence", "two-board-context"),
    source={
        "player": "RyanTime",
        "game_id": "175403513133",
        "partner_game_id": "175403513135",
        "url": "https://www.chess.com/live/game/175403513133",
    },
    players={
        "board_a_white": "RyanTime",
        "board_a_black": "Boratinio",
        "board_b_white": "Amiran1217",
        "board_b_black": "rookie879",
    },
    solution=(
        PuzzleStep(board="A", san="e8=Q+", solver=True),
        PuzzleStep(board="A", san="Rxe8", solver=False),
        PuzzleStep(board="A", san="Nxe8", solver=True),
        PuzzleStep(board="A", san="R@e4+", solver=False),
        PuzzleStep(board="A", san="@e2", solver=True),
        PuzzleStep(board="A", san="Q@d7", solver=False),
        PuzzleStep(board="A", san="Q@a3", solver=True),
        PuzzleStep(board="A", san="N@a4", solver=False),
    ),
)

PUZZLES: dict[str, PuzzleRecord] = {RYANTIME_PUZZLE.id: RYANTIME_PUZZLE}


def get_puzzle(puzzle_id: str) -> PuzzleRecord | None:
    return PUZZLES.get(puzzle_id)


def check_move(puzzle: PuzzleRecord, history: list[PuzzleMove]) -> dict[str, object]:
    if not _history_is_valid(puzzle, history):
        return {"status": "wrong_move"}
    cursor = len(history)
    if cursor >= len(puzzle.solution):
        return {"complete": True, "moves": []}
    continuation: list[PuzzleStep] = []
    while cursor < len(puzzle.solution) and not puzzle.solution[cursor].solver:
        continuation.append(puzzle.solution[cursor])
        cursor += 1
    return {"complete": cursor >= len(puzzle.solution), "moves": _move_runs(continuation)}


def next_move(puzzle: PuzzleRecord, history: list[PuzzleMove]) -> dict[str, object]:
    if not _history_is_valid(puzzle, history):
        return {"status": "wrong_move"}
    cursor = len(history)
    if cursor >= len(puzzle.solution):
        return {"complete": True, "moves": []}
    continuation = [puzzle.solution[cursor]]
    cursor += 1
    while cursor < len(puzzle.solution) and not puzzle.solution[cursor].solver:
        continuation.append(puzzle.solution[cursor])
        cursor += 1
    return {"complete": cursor >= len(puzzle.solution), "moves": _move_runs(continuation)}


def solution(puzzle: PuzzleRecord, history: list[PuzzleMove]) -> dict[str, object]:
    if not _history_is_valid(puzzle, history):
        return {"status": "wrong_move"}
    return {"complete": True, "moves": _move_runs(puzzle.solution[len(history) :])}


def validate_seed(puzzle: PuzzleRecord) -> list[str]:
    history = [PuzzleMove(board=step.board, san=step.san) for step in puzzle.solution]
    return [] if _history_is_valid(puzzle, history) else [f"{puzzle.id}: solution is not a legal line"]


def _history_is_valid(puzzle: PuzzleRecord, history: list[PuzzleMove]) -> bool:
    if len(history) > len(puzzle.solution):
        return False
    board_a_fen, board_b_fen = puzzle.boards
    for move, expected in zip(history, puzzle.solution, strict=False):
        if move.board != expected.board or _normalize_san(move.san) != _normalize_san(expected.san):
            return False
        result = apply_exploration_san_move(
            ExplorationSanMoveRequest(
                board_a_fen=board_a_fen,
                board_b_fen=board_b_fen,
                board=expected.board,
                san=move.san,
            )
        )
        if not result.get("legal"):
            return False
        board_a_fen = str(result["board_a_fen"])
        board_b_fen = str(result["board_b_fen"])
    return True


def _move_runs(steps: Iterable[PuzzleStep]) -> list[dict[str, object]]:
    runs: list[dict[str, object]] = []
    for step in steps:
        if runs and runs[-1]["board"] == step.board:
            moves = runs[-1]["moves"]
            assert isinstance(moves, list)
            moves.append(step.san)
        else:
            runs.append({"board": step.board, "moves": [step.san]})
    return runs


def _normalize_san(value: str) -> str:
    return (
        value.strip()
        .replace(" ", "")
        .replace("+", "")
        .replace("#", "")
        .lower()
    )


assert RYANTIME_PUZZLE_ID == "9a026277569e649bc6d2133c98383990fe75f4e1"
assert not validate_seed(RYANTIME_PUZZLE)
