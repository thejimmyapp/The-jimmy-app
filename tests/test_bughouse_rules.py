from __future__ import annotations

import unittest
from unittest.mock import patch

import chess
import chess.variant

from thejimmyapp.board_renderer import (
    _apply_bughouse_move,
    build_bughouse_pair_positions,
    build_global_replay_frames,
    render_dual_position_html,
    render_game_replay_html,
)
from thejimmyapp.pgn_parser import MoveRecord, parse_pgn, parse_tcn


def move(
    ply: int,
    uci: str,
    color: str,
    *,
    clock: float | None = None,
    drop: str | None = None,
) -> MoveRecord:
    return MoveRecord(
        ply=ply,
        move_number=(ply + 1) // 2,
        color=color,
        san=f"{drop}@{uci.split('@', 1)[1]}" if drop else uci,
        clock_seconds=clock,
        is_drop=drop is not None,
        uci=uci,
        drop_piece=drop,
    )


def material_count(position: object) -> int:
    board_count = sum(bool(piece) for rank in position.board for piece in rank)
    pockets = sum(
        len(value)
        for value in (
            position.white_pocket,
            position.black_pocket,
        )
        if value != "-"
    )
    return board_count + pockets


class BughouseTimelineTests(unittest.TestCase):
    def test_replay_uses_only_side_pocket_rails(self) -> None:
        html = render_game_replay_html([], [])
        self.assertNotIn('class="pockets"', html)
        self.assertNotIn('id="whitePocketVisual"', html)
        self.assertIn('id="whitePocketRail"', html)
        self.assertIn('id="partnerBlackPocketRail"', html)
        self.assertIn('data-renderer-version="compact-pocket-rails-v1"', html)

    def test_workspace_controls_are_above_the_boards(self) -> None:
        html = render_game_replay_html([], [])
        self.assertLess(html.index('class="controls"'), html.index('class="boards"'))

    def test_free_study_renders_two_boards_with_side_rails(self) -> None:
        fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[] w KQkq - 0 1"
        html = render_dual_position_html(fen, fen)
        self.assertIn('id="board"', html)
        self.assertIn('id="partnerBoard"', html)
        self.assertNotIn('class="pockets"', html)
        self.assertIn('id="whitePocketRail"', html)
        self.assertIn('id="partnerWhitePocketRail"', html)

    def test_capture_precedes_partner_drop_without_creating_material(self) -> None:
        main = [
            move(1, "e2e4", "white", clock=179.0),
            move(2, "d7d5", "black", clock=178.0),
            move(3, "e4d5", "white", clock=177.0),
            move(4, "g8f6", "black", clock=171.0),
        ]
        partner = [
            move(1, "e2e4", "white", clock=180.0),
            move(2, "P@e6", "black", clock=174.0, drop="P"),
        ]

        main_positions, partner_positions = build_bughouse_pair_positions(main, partner)

        self.assertEqual(
            material_count(main_positions[-1]) + material_count(partner_positions[-1]),
            64,
        )
        self.assertEqual(partner_positions[-1].black_pocket, "-")

    def test_global_timeline_contains_every_move_on_both_boards(self) -> None:
        main = [move(1, "e2e4", "white", clock=179.0), move(2, "e7e5", "black", clock=178.0)]
        partner = [move(1, "d2d4", "white", clock=177.0), move(2, "d7d5", "black", clock=176.0)]
        frames = build_global_replay_frames(main, partner)
        self.assertEqual(len(frames), 5)
        self.assertEqual({frame.board for frame in frames[1:]}, {"A", "B"})
        self.assertEqual(frames[-1].board_a.ply, 2)
        self.assertEqual(frames[-1].board_b.ply, 2)

    def test_global_timeline_marks_missing_cross_board_clocks_as_approximate(self) -> None:
        main = [move(1, "e2e4", "white")]
        partner = [move(1, "d2d4", "white")]

        frames = build_global_replay_frames(main, partner)

        self.assertIn("Cross-board move order is approximate", frames[-1].board_a.warning)
        self.assertIn("Cross-board move order is approximate", frames[-1].board_b.warning)
        self.assertEqual(frames[-1].board_a.confidence, "low")

    def test_global_timeline_stops_a_board_after_an_illegal_source_move(self) -> None:
        main = [
            move(1, "P@a1", "white", drop="P"),
            move(2, "e2e4", "black"),
        ]

        frames = build_global_replay_frames(main, [])

        self.assertEqual(frames[-1].board_a.ply, 0)
        self.assertEqual(frames[-1].board_a.white_pocket, "-")
        self.assertIn("Stopped before 1. P@a1", frames[-1].board_a.warning)

    def test_captured_promoted_piece_transfers_as_pawn(self) -> None:
        main_board = chess.variant.CrazyhouseBoard("4k3/4Q~3/8/8/8/8/8/4K3[] b - - 0 1")
        partner_board = chess.variant.CrazyhouseBoard()
        capture = MoveRecord(1, 1, "black", "Kxe7", uci="e8e7", is_capture=True)

        _apply_bughouse_move(main_board, partner_board, capture, transfer_to_partner=True)

        self.assertEqual(partner_board.pockets[chess.WHITE].count(chess.PAWN), 1)
        self.assertEqual(partner_board.pockets[chess.WHITE].count(chess.QUEEN), 0)

    def test_illegal_pawn_drop_on_first_rank_is_rejected(self) -> None:
        board = chess.variant.CrazyhouseBoard()
        partner = chess.variant.CrazyhouseBoard()
        illegal = move(1, "P@a1", "white", drop="P")

        with self.assertRaises(ValueError):
            _apply_bughouse_move(board, partner, illegal, transfer_to_partner=True)
        self.assertEqual(board.pockets[chess.WHITE].count(chess.PAWN), 0)


class ParserRegressionTests(unittest.TestCase):
    def test_en_passant_annotation_is_not_parsed_as_a_move(self) -> None:
        parsed = parse_pgn("[Result \"*\"]\n\n1. e4 a6 2. e5 d5 3. exd6 e.p. *")
        self.assertEqual([item.san for item in parsed.moves], ["e4", "a6", "e5", "d5", "exd6"])

    @patch(
        "thejimmyapp.pgn_parser.decode_tcn",
        return_value=[
            {"from": "e2", "to": "e4"},
            {"from": "d7", "to": "d5"},
            {"drop": "p", "to": "e6"},
            {"from": "d5", "to": "e4"},
        ],
    )
    def test_tcn_capture_is_detected_after_a_drop(self, _decode: object) -> None:
        parsed = parse_tcn("unused", {"time_control": "180"})
        self.assertTrue(parsed.moves[3].is_capture)
        self.assertIn("x", parsed.moves[3].san)

    @patch(
        "thejimmyapp.pgn_parser.decode_tcn",
        return_value=[
            {"from": "e2", "to": "e4"},
            {"from": "e7", "to": "e5"},
            {"drop": "r", "to": "e7"},
        ],
    )
    def test_tcn_check_is_detected_on_a_drop(self, _decode: object) -> None:
        parsed = parse_tcn("unused", {"time_control": "180"})
        self.assertTrue(parsed.moves[2].is_check)
        self.assertIn("+", parsed.moves[2].san)

    @patch(
        "thejimmyapp.pgn_parser.decode_tcn",
        return_value=[
            {"from": "e2", "to": "e4"},
            {"from": "e7", "to": "e5"},
            {"from": "g1", "to": "f3"},
        ],
    )
    def test_increment_is_included_in_elapsed_time(self, _decode: object) -> None:
        parsed = parse_tcn(
            "unused",
            {
                "time_control": "180+2",
                "moveTimestamps": "1800,1800,1795",
            },
        )
        self.assertAlmostEqual(parsed.moves[0].time_spent_seconds or 0, 2.0)
        self.assertAlmostEqual(parsed.moves[2].time_spent_seconds or 0, 2.5)
        self.assertAlmostEqual(parsed.moves[2].elapsed_seconds or 0, 6.5)


if __name__ == "__main__":
    unittest.main()
