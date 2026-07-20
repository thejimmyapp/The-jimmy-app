from __future__ import annotations

from dataclasses import dataclass

try:
    import chess
    import chess.variant
except ImportError:  # pragma: no cover
    chess = None


@dataclass(frozen=True, slots=True)
class PatternPuzzle:
    id: str
    title: str
    category: str
    motif: str
    difficulty: int
    fen: str
    orientation: str
    prompt: str
    solutions: tuple[str, ...]
    hint: str
    explanation: str
    follow_up: str


PUZZLES: tuple[PatternPuzzle, ...] = (
    PatternPuzzle(
        id="fork_n_f7",
        title="Knight drop fork on f7",
        category="Offensive drops",
        motif="fork",
        difficulty=1,
        fen="3qk2r/8/8/8/8/8/8/4K3[N] w - - 0 1",
        orientation="white",
        prompt="White to move. Use the pocket to attack both heavy pieces.",
        solutions=("N@f7",),
        hint="A knight can attack d8 and h8 from the same square.",
        explanation="N@f7 attacks the queen on d8 and rook on h8. This is one of the most reusable Bughouse drop forks.",
        follow_up="Before every knight drop, scan all enemy queens, rooks, kings, and mating squares it attacks.",
    ),
    PatternPuzzle(
        id="pin_b_b5",
        title="Bishop drop pin",
        category="Offensive drops",
        motif="pin",
        difficulty=1,
        fen="4k3/3q4/8/8/8/8/8/4K3[B] w - - 0 1",
        orientation="white",
        prompt="White to move. Pin the queen to the king.",
        solutions=("B@b5",),
        hint="Look for a diagonal ending on e8.",
        explanation="B@b5 creates a line through c6 and d7 to the king on e8. The queen cannot safely leave that line.",
        follow_up="Drops create instant lines. Scan bishop diagonals before spending the bishop elsewhere.",
    ),
    PatternPuzzle(
        id="rook_back_rank",
        title="Back-rank rook drop",
        category="Bughouse mates",
        motif="back rank mate",
        difficulty=1,
        fen="6k1/5ppp/8/8/8/8/8/6K1[R] w - - 0 1",
        orientation="white",
        prompt="White to move and mate in one.",
        solutions=("R@e8", "R@a8", "R@b8", "R@c8", "R@d8"),
        hint="The king has no flight square and the eighth rank is open.",
        explanation="A rook drop on the eighth rank gives mate because the king is boxed in by its own pawns.",
        follow_up="Whenever three pawns trap a king, scan every legal rook or queen drop on the back rank.",
    ),
    PatternPuzzle(
        id="knight_drop_mate",
        title="Knight drop mate",
        category="Bughouse mates",
        motif="knight drop mate",
        difficulty=2,
        fen="6rk/6pp/8/8/8/8/8/6K1[N] w - - 0 1",
        orientation="white",
        prompt="White to move. Find the forcing knight drop.",
        solutions=("N@f7",),
        hint="The knight must check h8 while covering escape squares.",
        explanation="N@f7+ attacks h8 and h6. With the king boxed by its own pieces, the drop creates a decisive mating net.",
        follow_up="Knight drops are strongest when the king has few squares and cannot capture the dropped piece.",
    ),
    PatternPuzzle(
        id="hanging_queen",
        title="Take the hanging queen",
        category="Classical tactics",
        motif="hanging piece",
        difficulty=1,
        fen="4k3/8/8/3q4/4B3/8/8/4K3[] w - - 0 1",
        orientation="white",
        prompt="White to move. Win the loose piece.",
        solutions=("e4d5", "Bxd5"),
        hint="Do not search for a drop when a direct capture wins material.",
        explanation="Bxd5 simply wins the undefended queen. Bughouse speed should not make you overlook ordinary hanging pieces.",
        follow_up="Before calculating a sacrifice, scan checks, captures, and undefended pieces.",
    ),
    PatternPuzzle(
        id="remove_defender",
        title="Remove the defender",
        category="Classical tactics",
        motif="removal of defender",
        difficulty=2,
        fen="4k3/5q2/4n3/8/2B5/8/8/4K3[] w - - 0 1",
        orientation="white",
        prompt="White to move. Remove a key defender with tempo.",
        solutions=("c4e6", "Bxe6"),
        hint="The knight on e6 is overloaded as a defender.",
        explanation="Bxe6 removes the knight and attacks the queen on f7, gaining time for the follow-up.",
        follow_up="When a valuable piece seems defended, ask whether the defender can be captured with tempo.",
    ),
    PatternPuzzle(
        id="defensive_pawn_drop",
        title="Emergency defensive drop",
        category="Defensive drops",
        motif="failed defensive drop",
        difficulty=2,
        fen="4k3/8/1q6/8/8/8/8/6K1[P] w - - 0 1",
        orientation="white",
        prompt="White to move. Block the immediate queen check safely.",
        solutions=("P@f2",),
        hint="Place a pawn between the queen and king.",
        explanation="P@f2 blocks the queen's line and gives the king breathing room. Defensive drops often matter more than counterattacks.",
        follow_up="Under attack, first list legal blocks, captures, king moves, and pocket defenses.",
    ),
    PatternPuzzle(
        id="queen_danger_hold",
        title="Do not feed the queen",
        category="Material management",
        motif="feeding dangerous material",
        difficulty=2,
        fen="6k1/5ppp/8/8/8/8/3q4/3R2K1[] w - - 0 1",
        orientation="white",
        prompt="White to move. Avoid the automatic trade and save the rook.",
        solutions=("d1f1", "Rf1"),
        hint="Capturing the queen may send a queen to the other board. Look for a safe retreat.",
        explanation="Rf1 declines the queen capture and keeps the rook safe. In Bughouse, a favorable-looking trade can feed the most dangerous attacking piece to the other board.",
        follow_up="Before every queen capture, ask whether your partner can survive the transferred queen.",
    ),
    PatternPuzzle(
        id="interference_drop",
        title="Interference drop",
        category="Classical tactics",
        motif="interference",
        difficulty=3,
        fen="k3r3/8/8/8/8/8/8/4K3[B] w - - 0 1",
        orientation="white",
        prompt="White to move. Break the rook's line with a drop.",
        solutions=("B@e2",),
        hint="A dropped piece can block an attack immediately.",
        explanation="B@e2 interferes with the rook's line to the king. Bughouse makes interference especially common because blockers can appear instantly.",
        follow_up="When a sliding piece attacks your king, inspect every pocket piece that can block the line.",
    ),
    PatternPuzzle(
        id="quiet_king_safety",
        title="Proactive king safety",
        category="Strategic patterns",
        motif="king safety",
        difficulty=2,
        fen="6k1/5pp1/7p/8/8/8/6PP/6K1[P] w - - 0 1",
        orientation="white",
        prompt="White to move. Create luft before the attack arrives.",
        solutions=("P@h3",),
        hint="Use the pocket to prevent a future back-rank net.",
        explanation="P@h3 gives the king an escape square and removes common rook/queen drop mating ideas.",
        follow_up="Good Bughouse defense is often proactive: spend a pawn now to prevent a forced sequence later.",
    ),
)


def get_puzzles(category: str = "All", difficulty: int | None = None) -> list[PatternPuzzle]:
    rows = list(PUZZLES)
    if category != "All":
        rows = [puzzle for puzzle in rows if puzzle.category == category]
    if difficulty is not None:
        rows = [puzzle for puzzle in rows if puzzle.difficulty == difficulty]
    return rows


def get_puzzle(puzzle_id: str) -> PatternPuzzle | None:
    return next((puzzle for puzzle in PUZZLES if puzzle.id == puzzle_id), None)


def categories() -> list[str]:
    return sorted({puzzle.category for puzzle in PUZZLES})


def validate_library() -> list[str]:
    if chess is None:
        return ["python-chess is not installed"]
    errors: list[str] = []
    for puzzle in PUZZLES:
        try:
            board = chess.variant.CrazyhouseBoard(puzzle.fen)
        except Exception as exc:
            errors.append(f"{puzzle.id}: invalid FEN ({exc})")
            continue
        legal = {_normalize(move.uci()) for move in board.legal_moves}
        accepted_uci = {
            normalized
            for solution in puzzle.solutions
            if (normalized := _normalize(solution)) in legal
        }
        if not accepted_uci:
            errors.append(f"{puzzle.id}: no accepted solution is legal")
        if puzzle.id in {"rook_back_rank", "knight_drop_mate"}:
            for solution in accepted_uci:
                move = next(move for move in board.legal_moves if _normalize(move.uci()) == solution)
                after = board.copy(stack=False)
                after.push(move)
                if not after.is_checkmate():
                    errors.append(f"{puzzle.id}: {solution} is accepted but is not mate")
    return errors


def score_solution(attempt: str, puzzle: PatternPuzzle) -> str:
    normalized = _normalize(attempt)
    solutions = {_normalize(solution) for solution in puzzle.solutions}
    if normalized in solutions:
        return "correct"
    destination = _destination(normalized)
    if destination and any(_destination(solution) == destination for solution in solutions):
        return "close"
    return "incorrect"


def _normalize(value: str) -> str:
    return (
        str(value or "")
        .strip()
        .replace(" ", "")
        .replace("-", "")
        .replace("x", "")
        .replace("+", "")
        .replace("#", "")
        .replace("=", "")
        .lower()
    )


def _destination(value: str) -> str | None:
    if "@" in value:
        return value.split("@", 1)[1][:2]
    return value[-2:] if len(value) >= 2 else None
