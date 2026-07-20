from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from thejimmyapp.analyzer import _estimated_loss, _legal_bestmove
from thejimmyapp.engine import EngineAnalysis, EngineConfig, EngineError, FairyStockfishEngine


class EngineLifecycleTests(unittest.TestCase):
    def test_missing_engine_fails_cleanly(self) -> None:
        engine = FairyStockfishEngine(EngineConfig(path=Path("does-not-exist")))
        with self.assertRaises(EngineError):
            engine.start()
        self.assertIsNone(engine.process)

    def test_handshake_failure_closes_spawned_process(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine_path = Path(temp_dir) / "engine.exe"
            engine_path.touch()
            process = MagicMock()
            process.stdin = MagicMock()
            process.stdout = iter(())
            process.poll.return_value = None
            process.wait.return_value = 0

            with patch("thejimmyapp.engine.subprocess.Popen", return_value=process):
                engine = FairyStockfishEngine(
                    EngineConfig(path=engine_path, timeout_seconds=0.02)
                )
                with self.assertRaises(EngineError):
                    engine.start()

            self.assertIsNone(engine.process)
            written = "".join(call.args[0] for call in process.stdin.write.call_args_list)
            self.assertIn("quit", written)


class EngineScoringTests(unittest.TestCase):
    @staticmethod
    def analysis(*, cp: int | None = None, mate: int | None = None) -> EngineAnalysis:
        return EngineAnalysis("", None, cp, mate, [], 10, True, "test")

    def test_cp_loss_is_from_movers_point_of_view(self) -> None:
        self.assertEqual(
            _estimated_loss(self.analysis(cp=120), self.analysis(cp=-20)),
            100,
        )

    def test_missed_mate_has_large_loss(self) -> None:
        loss = _estimated_loss(self.analysis(mate=2), self.analysis(cp=0))
        self.assertIsNotNone(loss)
        self.assertGreater(loss, 90_000)

    def test_illegal_bestmove_is_rejected(self) -> None:
        fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[] w KQkq - 0 1"
        self.assertEqual(_legal_bestmove(fen, "e2e4"), "e2e4")
        self.assertIsNone(_legal_bestmove(fen, "N@e4"))


if __name__ == "__main__":
    unittest.main()
