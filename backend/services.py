from __future__ import annotations

import asyncio
import json
from dataclasses import asdict
from pathlib import Path
from uuid import uuid4

from backend.config import Settings
from src.board_renderer import build_bughouse_pair_positions, build_global_replay_frames, build_replay_positions
from src.db import Database
from src.engine import EngineConfig, FairyStockfishEngine
from src.pgn_parser import parse_game_data, parse_partner_tcn


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
        partner = parse_partner_tcn(str(game.get("raw_json") or ""))
        try:
            raw = json.loads(str(game.get("raw_json") or "{}"))
        except json.JSONDecodeError:
            raw = {}
        players = {
            "board_a_white": str(game.get("white_username") or raw.get("bughousePlayer1Name") or "White"),
            "board_a_black": str(game.get("black_username") or raw.get("bughousePlayer2Name") or "Black"),
            "board_b_white": str(raw.get("bughousePartnerPlayer1Name") or "White"),
            "board_b_black": str(raw.get("bughousePartnerPlayer2Name") or "Black"),
        }
        if partner:
            main_positions, partner_positions = build_bughouse_pair_positions(parsed.moves, partner.moves)
            timeline = build_global_replay_frames(parsed.moves, partner.moves)
        else:
            main_positions = build_replay_positions(parsed.moves)
            partner_positions = []
            timeline = []
        return {
            "game": game,
            "players": players,
            "moves_a": [{**asdict(move), "display_move": move.display_move} for move in parsed.moves],
            "moves_b": [{**asdict(move), "display_move": move.display_move} for move in partner.moves] if partner else [],
            "positions_a": [asdict(position) for position in main_positions],
            "positions_b": [asdict(position) for position in partner_positions],
            "timeline": [asdict(frame) for frame in timeline],
            "second_board_available": bool(partner_positions),
            "limitations": [] if partner_positions else ["Second board unavailable"],
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

    async def submit(self, game_id: int, global_ply: int, board: str, depth: int) -> str:
        job_id = str(uuid4())
        self.jobs[job_id] = {"status": "queued"}
        asyncio.create_task(self._run(job_id, game_id, global_ply, board, depth))
        return job_id

    async def _run(self, job_id: str, game_id: int, global_ply: int, board: str, depth: int) -> None:
        async with self.semaphore:
            self.jobs[job_id] = {"status": "running"}
            snapshot = await asyncio.to_thread(self.games.snapshot, game_id, global_ply)
            position = snapshot.get("board_a" if board == "A" else "board_b") if snapshot else None
            if not isinstance(position, dict):
                self.jobs[job_id] = {"status": "failed", "error": "Board position unavailable"}
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
                self.jobs[job_id] = {"status": "completed", "result": self.cache[cache_key], "cached": True}
                return
            config = EngineConfig(path=self.settings.fairy_stockfish_path, depth=depth)
            try:
                result = await asyncio.wait_for(
                    asyncio.to_thread(self._analyze, str(position["variant_fen"]), config),
                    timeout=self.settings.engine_timeout_seconds,
                )
                self.cache[cache_key] = result
                self.jobs[job_id] = {"status": "completed", "result": result}
            except Exception as exc:
                self.jobs[job_id] = {"status": "failed", "error": str(exc)}

    @staticmethod
    def _analyze(fen: str, config: EngineConfig) -> dict[str, object]:
        with FairyStockfishEngine(config) as engine:
            return asdict(engine.analyze_fen(fen))
