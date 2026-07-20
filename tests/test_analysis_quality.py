from __future__ import annotations

import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from thejimmyapp.db import Database
from thejimmyapp.board_renderer import _json_for_script
from thejimmyapp.chesscom_api import ChessComApiError, normalize_username
from thejimmyapp.pattern_academy import get_puzzle, validate_library
from thejimmyapp.phase4 import classify_bughouse_category
from thejimmyapp.opening_lab import _position_key
from thejimmyapp.versioning import ANALYSIS_VERSION


class AnalysisVersionTests(unittest.TestCase):
    def test_legacy_mistakes_are_preserved_but_hidden(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "coach.db"
            db = Database(path)
            db.initialize()
            with closing(sqlite3.connect(path)) as conn:
                conn.execute(
                    """
                    INSERT INTO games (username, url, result, raw_json, imported_at)
                    VALUES ('player', 'https://example.test/game', 'loss', '{}', 'now')
                    """
                )
                game_id = int(conn.execute("SELECT id FROM games").fetchone()[0])
                conn.execute(
                    """
                    INSERT INTO mistakes (
                        game_id, username, ply, move, side, reason, category,
                        tactical_motif, severity, estimated_loss_cp, bestmove,
                        score_before, score_after, depth, confidence, note,
                        analysis_version, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        game_id, "player", 1, "e4", "white", "test", "tactical miss",
                        "unknown", "mistake", 100, "e2e4", "0.00", "-1.00", 10,
                        "low", "legacy", "legacy", "now",
                    ),
                )
                conn.commit()

            self.assertEqual(db.get_mistake_summary("player")["mistakes"], 0)
            with closing(sqlite3.connect(path)) as conn:
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM mistakes").fetchone()[0], 1)
                self.assertNotEqual(ANALYSIS_VERSION, "legacy")

            db.replace_game_mistakes(
                game_id,
                10,
                [{
                    "username": "player", "ply": 1, "move": "e4", "side": "white",
                    "reason": "test", "category": "tactical miss", "severity": "mistake",
                    "estimated_loss_cp": 100, "bestmove": "e2e4", "score_before": "0.00",
                    "score_after": "-1.00", "depth": 10, "confidence": "high", "note": "current",
                }],
            )
            self.assertEqual(db.get_mistake_summary("player")["mistakes"], 1)


class CoachingLabelTests(unittest.TestCase):
    def test_low_clock_does_not_relabel_tactical_error_as_tempo_loss(self) -> None:
        category = classify_bughouse_category(
            move="e4", bestmove="e2e4", reason="capture", clock_seconds=5
        )
        self.assertEqual(category, "feeding material")

    def test_long_think_is_named_time_management(self) -> None:
        category = classify_bughouse_category(
            move="e4", bestmove="e2e4", reason="", time_spent_seconds=15
        )
        self.assertEqual(category, "time management")


class PatternLibraryTests(unittest.TestCase):
    def test_library_has_no_structural_or_mate_errors(self) -> None:
        self.assertEqual(validate_library(), [])

    def test_false_rook_mate_is_not_accepted(self) -> None:
        puzzle = get_puzzle("rook_back_rank")
        self.assertIsNotNone(puzzle)
        assert puzzle is not None
        self.assertNotIn("R@f8", puzzle.solutions)


class InputSafetyTests(unittest.TestCase):
    def test_username_is_normalized_and_path_characters_are_rejected(self) -> None:
        self.assertEqual(normalize_username(" Alfa-Swing_1 "), "alfa-swing_1")
        with self.assertRaises(ChessComApiError):
            normalize_username("../player")

    def test_embedded_json_cannot_close_script_tag(self) -> None:
        payload = _json_for_script({"name": "</script><script>alert(1)</script>"})
        self.assertNotIn("</script>", payload)


class OpeningPositionTests(unittest.TestCase):
    def test_position_key_includes_pockets_and_partner_board(self) -> None:
        main = "8/8/8/8/8/8/8/4K3[N] w - - 0 1"
        partner_a = "8/8/8/8/8/8/8/4k3[] b - - 0 1"
        partner_b = "8/8/8/8/8/8/8/4k3[P] b - - 0 1"
        self.assertNotEqual(_position_key(main, partner_a), _position_key(main, partner_b))


if __name__ == "__main__":
    unittest.main()
