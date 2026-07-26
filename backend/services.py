from __future__ import annotations

import asyncio
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any
from uuid import uuid4

from backend.config import Settings
from thejimmyapp.board_renderer import build_bughouse_pair_positions, build_global_replay_frames, build_replay_positions
from thejimmyapp.db import Database
from thejimmyapp.engine import EngineConfig, FairyStockfishEngine
from thejimmyapp.pgn_parser import parse_game_data, parse_partner_game_data


class GameService:
    def __init__(self, database_path: Path) -> None:
        self.db = Database(database_path)
        self.db.initialize()

    def list_games(self, username: str, limit: int = 500) -> list[dict[str, object]]:
        return self.db.list_games(username=username, limit=limit)

    def get_game_payload(self, game_id: int) -> dict[str, object] | None:
        game = self.db.get_game(game_id)
        if not game:
            return None
        parsed = parse_game_data(str(game.get("pgn") or ""), str(game.get("raw_json") or ""))
        partner = parse_partner_game_data(str(game.get("raw_json") or ""))
        try:
            raw = json.loads(str(game.get("raw_json") or "{}"))
        except json.JSONDecodeError:
            raw = {}
        players = {
            "board_a_white": str(game.get("white_username") or raw.get("bughousePlayer1Name") or "White"),
            "board_a_black": str(game.get("black_username") or raw.get("bughousePlayer2Name") or "Black"),
            "board_b_white": str(
                raw.get("bughousePartnerPlayer1Name")
                or (partner.headers.get("White") if partner else None)
                or "White"
            ),
            "board_b_black": str(
                raw.get("bughousePartnerPlayer2Name")
                or (partner.headers.get("Black") if partner else None)
                or "Black"
            ),
        }
        if partner:
            main_positions, partner_positions = build_bughouse_pair_positions(parsed.moves, partner.moves)
            timeline = build_global_replay_frames(parsed.moves, partner.moves)
        else:
            main_positions = build_replay_positions(parsed.moves)
            partner_positions = []
            timeline = []
        limitations = list(parsed.parse_warnings)
        if partner:
            limitations.extend(partner.parse_warnings)
            if timeline and any(
                "Cross-board move order is approximate" in frame.board_a.warning
                for frame in timeline[1:]
            ):
                limitations.append(
                    "Cross-board move order is approximate because complete clock timestamps are unavailable."
                )
        else:
            limitations.append("Second board unavailable")
        limitations = list(dict.fromkeys(item for item in limitations if item))
        return {
            "game": game,
            "players": players,
            "moves_a": [{**asdict(move), "display_move": move.display_move} for move in parsed.moves],
            "moves_b": [{**asdict(move), "display_move": move.display_move} for move in partner.moves] if partner else [],
            "positions_a": [asdict(position) for position in main_positions],
            "positions_b": [asdict(position) for position in partner_positions],
            "timeline": [asdict(frame) for frame in timeline],
            "second_board_available": bool(partner_positions),
            "limitations": limitations,
            "outcome": _game_outcome(game, raw, players, parsed.moves, partner.moves if partner else []),
        }

    def snapshot(self, game_id: int, global_ply: int) -> dict[str, object] | None:
        payload = self.get_game_payload(game_id)
        if not payload:
            return None
        timeline = payload["timeline"]
        if timeline:
            index = max(0, min(global_ply, len(timeline) - 1))
            frame = timeline[index]
            return {"global_ply": index, "board_a": frame["board_a"], "board_b": frame["board_b"]}
        positions_a = payload["positions_a"]
        index = max(0, min(global_ply, len(positions_a) - 1))
        position_a = positions_a[index]
        partner_index = position_a.get("partner_index") if isinstance(position_a, dict) else None
        positions_b = payload["positions_b"]
        position_b = positions_b[partner_index] if positions_b and partner_index is not None else None
        return {"global_ply": index, "board_a": position_a, "board_b": position_b}


class AnalysisJobs:
    def __init__(self, settings: Settings, games: GameService) -> None:
        self.settings = settings
        self.games = games
        self.jobs: dict[str, dict[str, object]] = {}
        self.cache: dict[str, dict[str, object]] = {}
        self.semaphore = asyncio.Semaphore(2)

    async def submit(
        self,
        game_id: int,
        global_ply: int,
        board: str,
        depth: int,
        variant_fen: str | None = None,
        board_a_fen: str | None = None,
        board_b_fen: str | None = None,
    ) -> str:
        job_id = str(uuid4())
        self.jobs[job_id] = {
            "status": "queued",
            "engine": "Fairy-Stockfish",
            "board": board,
            "global_ply": global_ply,
            "depth": depth,
        }
        asyncio.create_task(
            self._run(job_id, game_id, global_ply, board, depth, variant_fen, board_a_fen, board_b_fen)
        )
        return job_id

    async def _run(
        self,
        job_id: str,
        game_id: int,
        global_ply: int,
        board: str,
        depth: int,
        variant_fen: str | None,
        board_a_fen: str | None,
        board_b_fen: str | None,
    ) -> None:
        async with self.semaphore:
            metadata = self.jobs[job_id]
            self.jobs[job_id] = {**metadata, "status": "running"}
            snapshot = None
            if variant_fen:
                snapshot = {
                    "board_a": {"variant_fen": board_a_fen or (variant_fen if board == "A" else "")},
                    "board_b": {"variant_fen": board_b_fen or (variant_fen if board == "B" else "")},
                }
            else:
                snapshot = await asyncio.to_thread(self.games.snapshot, game_id, global_ply)
            position = snapshot.get("board_a" if board == "A" else "board_b") if snapshot else None
            fen = variant_fen or (str(position.get("variant_fen") or "") if isinstance(position, dict) else "")
            if not fen:
                self.jobs[job_id] = {**metadata, "status": "failed", "error": "Board position unavailable"}
                return
            board_a = snapshot.get("board_a") if snapshot else None
            board_b = snapshot.get("board_b") if snapshot else None
            cache_key = "|".join(
                [
                    str(board_a.get("variant_fen") if isinstance(board_a, dict) else ""),
                    str(board_b.get("variant_fen") if isinstance(board_b, dict) else ""),
                    board,
                    str(depth),
                ]
            )
            if cache_key in self.cache:
                self.jobs[job_id] = {
                    **metadata,
                    "status": "completed",
                    "result": self.cache[cache_key],
                    "cached": True,
                }
                return
            config = EngineConfig(path=self.settings.fairy_stockfish_path, depth=depth)
            try:
                result = await asyncio.wait_for(
                    asyncio.to_thread(self._analyze, fen, config),
                    timeout=self.settings.engine_timeout_seconds,
                )
                self.cache[cache_key] = result
                self.jobs[job_id] = {**metadata, "status": "completed", "result": result}
            except Exception as exc:
                self.jobs[job_id] = {**metadata, "status": "failed", "error": str(exc)}

    @staticmethod
    def _analyze(fen: str, config: EngineConfig) -> dict[str, object]:
        with FairyStockfishEngine(config) as engine:
            return asdict(engine.analyze_fen(fen))


_LOSS_RESULTS = {"checkmated", "resigned", "timeout", "abandoned", "lose", "kingofthehill", "threecheck"}


def _game_outcome(
    game: dict[str, object],
    raw: dict[str, Any],
    players: dict[str, str],
    main_moves: list[Any],
    partner_moves: list[Any],
) -> dict[str, object]:
    """Build a truthful result sentence without inventing partner-board facts."""
    result = str(game.get("result") or "unknown").lower()
    if result == "draw":
        return {
            "summary": "The game was drawn.",
            "detail": "No player lost this game.",
            "loser_username": None,
            "termination": "draw",
            "board": None,
            "board_role": None,
            "move_number": None,
        }

    white = raw.get("white") if isinstance(raw.get("white"), dict) else {}
    black = raw.get("black") if isinstance(raw.get("black"), dict) else {}
    white_result = str(white.get("result") or game.get("white_result") or "").lower()
    black_result = str(black.get("result") or game.get("black_result") or "").lower()

    loser: str | None = None
    termination: str | None = None
    deciding_board: str | None = None
    move_number: int | None = None
    if white_result in _LOSS_RESULTS:
        loser = str(players["board_a_white"])
        termination = white_result
        deciding_board = "A"
        move_number = _last_move_number(main_moves)
    elif black_result in _LOSS_RESULTS:
        loser = str(players["board_a_black"])
        termination = black_result
        deciding_board = "A"
        move_number = _last_move_number(main_moves)
    else:
        terminal = _terminal_mate(main_moves, "A", players) or _terminal_mate(partner_moves, "B", players)
        if terminal:
            loser, deciding_board, move_number = terminal
            termination = "checkmated"

    if not loser:
        username = str(game.get("username") or "Unknown player")
        opponent = str(game.get("opponent") or "Unknown opponent")
        loser = username if result == "loss" else opponent if result == "win" else None
        summary = f"{loser}'s team lost." if loser else "The game result is unavailable."
        return {
            "summary": summary,
            "detail": "The deciding player, board, and finish are not present in the imported game data.",
            "loser_username": loser,
            "termination": None,
            "board": None,
            "board_role": None,
            "move_number": None,
        }

    board_role, role_detail = _board_role(deciding_board, raw, bool(partner_moves))
    board_label = f"the {board_role} board" if board_role else f"Board {deciding_board}"
    move_label = f" on move {move_number}" if move_number is not None else ""
    summary = f"{loser} {_termination_phrase(termination)} on {board_label}{move_label}."
    return {
        "summary": summary,
        "detail": role_detail,
        "loser_username": loser,
        "termination": termination,
        "board": deciding_board,
        "board_role": board_role,
        "move_number": move_number,
    }


def _terminal_mate(moves: list[Any], board: str, players: dict[str, str]) -> tuple[str, str, int] | None:
    if not moves or not bool(getattr(moves[-1], "is_mate", False)):
        return None
    winning_color = str(getattr(moves[-1], "color", "white"))
    losing_color = "black" if winning_color == "white" else "white"
    return players[f"board_{board.lower()}_{losing_color}"], board, int(getattr(moves[-1], "move_number", 0))


def _last_move_number(moves: list[Any]) -> int | None:
    if not moves:
        return None
    value = getattr(moves[-1], "move_number", None)
    return int(value) if value is not None else None


def _termination_phrase(termination: str | None) -> str:
    return {
        "checkmated": "was checkmated",
        "resigned": "resigned",
        "timeout": "lost on time",
        "abandoned": "abandoned the game",
        "kingofthehill": "lost by king of the hill",
        "threecheck": "lost by three-check",
        "lose": "lost",
    }.get(str(termination), "lost")


def _board_role(board: str | None, raw: dict[str, Any], partner_available: bool) -> tuple[str | None, str]:
    if not board:
        return None, "The deciding board is unavailable."
    info = raw.get("chesscom_pgn_info") if isinstance(raw.get("chesscom_pgn_info"), dict) else {}
    a_white = _first_int(_nested(raw, "white", "rating"), info.get("whiteRating"))
    a_black = _first_int(_nested(raw, "black", "rating"), info.get("blackRating"))
    b_white = _first_int(
        raw.get("bughousePartnerPlayer1Rating"), raw.get("bughousePartnerWhiteRating"),
        info.get("bughousePartnerPlayer1Rating"), info.get("bughousePartnerWhiteRating"),
    )
    b_black = _first_int(
        raw.get("bughousePartnerPlayer2Rating"), raw.get("bughousePartnerBlackRating"),
        info.get("bughousePartnerPlayer2Rating"), info.get("bughousePartnerBlackRating"),
    )
    if None in {a_white, a_black, b_white, b_black}:
        if not partner_available:
            return None, "High/low board unknown — second-board data is unavailable."
        return None, "High/low board unknown — second-board ratings are unavailable."
    # Bughouse partners play opposite colors: A-white pairs with B-black,
    # and A-black pairs with B-white. The high board has the stronger player
    # from each team, not merely the larger average rating.
    a_is_high = bool(a_white >= b_black and a_black >= b_white)
    b_is_high = bool(b_black >= a_white and b_white >= a_black)
    if not a_is_high and not b_is_high:
        return None, "High/low board is ambiguous because the higher-rated players are split across the boards."
    high_board = "A" if a_is_high else "B"
    return ("high" if board == high_board else "low"), "Board role is based on both teams' player ratings."


def _nested(value: dict[str, Any], key: str, child: str) -> object:
    nested = value.get(key)
    return nested.get(child) if isinstance(nested, dict) else None


def _first_int(*values: object) -> int | None:
    for value in values:
        try:
            if value is not None:
                return int(value)
        except (TypeError, ValueError):
            continue
    return None
