from __future__ import annotations

import subprocess
import queue
import threading
import time
from dataclasses import dataclass
from pathlib import Path


class EngineError(RuntimeError):
    """Raised when the UCI engine cannot be started or queried safely."""


@dataclass(slots=True)
class EngineAnalysis:
    fen: str
    bestmove: str | None
    score_cp: int | None
    mate_in: int | None
    pv: list[str]
    depth: int | None
    variant_supported: bool
    engine_name: str | None

    @property
    def score_label(self) -> str:
        if self.mate_in is not None:
            return f"mate {self.mate_in}"
        if self.score_cp is not None:
            return f"{self.score_cp / 100:.2f}"
        return "unknown"


@dataclass(slots=True)
class EngineConfig:
    path: Path
    depth: int = 10
    timeout_seconds: float = 12.0
    variant: str = "bughouse"
    threads: int = 1
    hash_mb: int = 64
    multipv: int = 1


class FairyStockfishEngine:
    def __init__(self, config: EngineConfig) -> None:
        self.config = config
        self.process: subprocess.Popen[str] | None = None
        self.engine_name: str | None = None
        self.variant_supported = False
        self._uci_options: list[str] = []
        self._output_queue: queue.Queue[str] = queue.Queue()
        self._reader_thread: threading.Thread | None = None

    def __enter__(self) -> FairyStockfishEngine:
        self.start()
        return self

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        self.close()

    def start(self) -> None:
        if not self.config.path.exists():
            raise EngineError(
                f"Fairy-Stockfish executable not found: {self.config.path}. "
                "Install Fairy-Stockfish, place its executable in the engines folder, "
                "or set FAIRY_STOCKFISH_PATH to the correct executable."
            )

        try:
            self.process = subprocess.Popen(
                [str(self.config.path)],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
        except OSError as exc:
            raise EngineError(f"Could not start Fairy-Stockfish: {exc}") from exc

        self._reader_thread = threading.Thread(target=self._read_stdout_forever, daemon=True)
        self._reader_thread.start()

        try:
            self._send("uci")
            for line in self._read_until("uciok", self.config.timeout_seconds):
                if line.startswith("id name "):
                    self.engine_name = line.removeprefix("id name ").strip()
                elif line.startswith("option "):
                    self._uci_options.append(line)

            self.variant_supported = self._supports_option("UCI_Variant")
            if self.variant_supported:
                self._send(f"setoption name UCI_Variant value {self.config.variant}")
            self._set_option_if_supported("Threads", max(1, self.config.threads))
            self._set_option_if_supported("Hash", max(16, self.config.hash_mb))
            self._set_option_if_supported("MultiPV", max(1, self.config.multipv))
            self._wait_ready()
        except Exception:
            self.close()
            raise

    def analyze_fen(self, fen: str) -> EngineAnalysis:
        self._ensure_started()
        self._send(f"position fen {fen}")
        self._send(f"go depth {self.config.depth}")

        bestmove: str | None = None
        last_score_cp: int | None = None
        last_mate_in: int | None = None
        last_depth: int | None = None
        last_pv: list[str] = []

        deadline = time.monotonic() + self.config.timeout_seconds
        while time.monotonic() < deadline:
            line = self._readline(deadline - time.monotonic())
            if not line:
                continue
            if line.startswith("info "):
                parsed = _parse_info_line(line)
                last_score_cp = parsed.score_cp if parsed.score_cp is not None else last_score_cp
                last_mate_in = parsed.mate_in if parsed.mate_in is not None else last_mate_in
                last_depth = parsed.depth if parsed.depth is not None else last_depth
                last_pv = parsed.pv or last_pv
                continue
            if line.startswith("bestmove "):
                parts = line.split()
                bestmove = parts[1] if len(parts) > 1 and parts[1] != "(none)" else None
                return EngineAnalysis(
                    fen=fen,
                    bestmove=bestmove,
                    score_cp=last_score_cp,
                    mate_in=last_mate_in,
                    pv=last_pv,
                    depth=last_depth,
                    variant_supported=self.variant_supported,
                    engine_name=self.engine_name,
                )

        raise EngineError(f"Engine timed out while analyzing FEN: {fen}")

    def close(self) -> None:
        process = self.process
        if not process:
            return
        try:
            if process.poll() is None:
                self._send("quit")
                process.wait(timeout=2)
        except Exception:
            if process.poll() is None:
                process.kill()
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    pass
        finally:
            self.process = None

    def _supports_option(self, name: str) -> bool:
        marker = f"name {name}"
        return any(marker in option for option in self._uci_options)

    def _set_option_if_supported(self, name: str, value: object) -> None:
        if self._supports_option(name):
            self._send(f"setoption name {name} value {value}")

    def _wait_ready(self) -> None:
        self._send("isready")
        self._read_until("readyok", self.config.timeout_seconds)

    def _send(self, command: str) -> None:
        self._ensure_started()
        assert self.process and self.process.stdin
        self.process.stdin.write(command + "\n")
        self.process.stdin.flush()

    def _read_until(self, marker: str, timeout_seconds: float) -> list[str]:
        lines: list[str] = []
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            line = self._readline(deadline - time.monotonic())
            if not line:
                continue
            lines.append(line)
            if line == marker:
                return lines
        raise EngineError(f"Engine did not answer with {marker!r} within {timeout_seconds:.1f}s.")

    def _readline(self, timeout_seconds: float) -> str:
        self._ensure_started()
        process = self.process
        assert process is not None
        if process.poll() is not None:
            raise EngineError("Engine process exited unexpectedly.")
        try:
            return self._output_queue.get(timeout=max(0.01, timeout_seconds)).strip()
        except queue.Empty:
            return ""

    def _ensure_started(self) -> None:
        if not self.process:
            raise EngineError("Engine has not been started.")

    def _read_stdout_forever(self) -> None:
        process = self.process
        if not process or not process.stdout:
            return
        try:
            for line in process.stdout:
                self._output_queue.put(line)
        except ValueError:
            return


@dataclass(slots=True)
class _ParsedInfo:
    score_cp: int | None = None
    mate_in: int | None = None
    depth: int | None = None
    pv: list[str] | None = None


def _parse_info_line(line: str) -> _ParsedInfo:
    parts = line.split()
    parsed = _ParsedInfo()
    if "depth" in parts:
        idx = parts.index("depth")
        if idx + 1 < len(parts):
            parsed.depth = _safe_int(parts[idx + 1])
    if "score" in parts:
        idx = parts.index("score")
        if idx + 2 < len(parts):
            score_type = parts[idx + 1]
            score_value = _safe_int(parts[idx + 2])
            if score_type == "cp":
                parsed.score_cp = score_value
                parsed.mate_in = None
            elif score_type == "mate":
                parsed.mate_in = score_value
                parsed.score_cp = None
    if "pv" in parts:
        idx = parts.index("pv")
        parsed.pv = parts[idx + 1 :]
    return parsed


def _safe_int(value: str) -> int | None:
    try:
        return int(value)
    except ValueError:
        return None
