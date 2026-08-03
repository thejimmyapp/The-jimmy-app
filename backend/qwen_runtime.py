from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import subprocess
import tempfile
import time

import httpx

from backend.config import Settings


class QwenRuntime:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._lock = asyncio.Lock()
        self._state = "disabled" if not settings.qwen_enabled else "not_downloaded"
        self._detail = "Qwen is disabled" if not settings.qwen_enabled else "Model downloads on first use"
        self._last_generation_seconds: float | None = None
        self._last_prompt_chars = 0
        self._last_output_chars = 0

    def status(self) -> dict[str, object]:
        model_exists = self.settings.qwen_model_path.is_file()
        binary_exists = self.settings.llama_cli_path.is_file()
        if not self.settings.qwen_enabled:
            state, detail = "disabled", "Qwen is disabled"
        elif self._state in {"running", "downloading", "failed"}:
            state, detail = self._state, self._detail
        elif model_exists and binary_exists:
            state, detail = "ready", "Model and local runtime are ready"
        elif not binary_exists:
            state, detail = "failed", "Local llama.cpp runtime is unavailable"
        else:
            state, detail = "not_downloaded", "Model downloads on first use"
        return {
            "enabled": self.settings.qwen_enabled,
            "state": state,
            "detail": detail,
            "model": self.settings.qwen_model_name,
            "model_file": self.settings.qwen_model_filename,
            "model_downloaded": model_exists,
            "runtime_available": binary_exists,
            "context_size": self.settings.qwen_context_size,
            "max_tokens": self.settings.qwen_max_tokens,
            "temperature": self.settings.qwen_temperature,
            "top_p": self.settings.qwen_top_p,
            "reasoning_budget": self.settings.qwen_reasoning_budget,
            "threads": self.settings.qwen_threads,
            "batch_threads": self.settings.qwen_batch_threads,
            "timeout_seconds": self.settings.qwen_timeout_seconds,
            "last_generation_seconds": self._last_generation_seconds,
            "last_prompt_chars": self._last_prompt_chars,
            "last_output_chars": self._last_output_chars,
        }

    async def explain(self, prompt: str, *, fact_ids: tuple[str, ...] = ()) -> str:
        if not self.settings.qwen_enabled:
            raise RuntimeError("Local Qwen coaching is disabled")
        async with self._lock:
            await self._ensure_model()
            self._state = "running"
            self._detail = "Qwen is explaining validated engine facts"
            try:
                answer = await asyncio.wait_for(
                    asyncio.to_thread(self._run_cli, prompt, fact_ids),
                    timeout=self.settings.qwen_timeout_seconds,
                )
            except Exception as exc:
                self._state = "failed"
                self._detail = f"Local generation failed: {type(exc).__name__}"
                raise
            else:
                self._state = "ready"
                self._detail = "Model and local runtime are ready"
                return answer

    async def _ensure_model(self) -> None:
        if not self.settings.llama_cli_path.is_file():
            raise RuntimeError(f"llama-cli not found: {self.settings.llama_cli_path}")
        if self.settings.qwen_model_path.is_file():
            return
        self._state = "downloading"
        self._detail = "Downloading the 2.71 GB Qwen model to persistent storage"
        try:
            await asyncio.to_thread(self._download_model)
        except Exception:
            self._state = "failed"
            self._detail = "Model download failed"
            raise

    def _download_model(self) -> None:
        target = self.settings.qwen_model_path
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix(target.suffix + ".part")
        free_bytes = shutil.disk_usage(target.parent).free
        if free_bytes < self.settings.qwen_min_free_bytes:
            raise RuntimeError("Not enough free storage for Qwen; at least 3.2 GB is required")
        headers = {"User-Agent": "thejimmyapp/1.0 qwen-downloader"}
        with httpx.stream(
            "GET",
            self.settings.qwen_model_url,
            headers=headers,
            follow_redirects=True,
            timeout=httpx.Timeout(30.0, read=300.0),
        ) as response:
            response.raise_for_status()
            with temporary.open("wb") as handle:
                for chunk in response.iter_bytes(1024 * 1024):
                    handle.write(chunk)
        if temporary.stat().st_size < 2_000_000_000:
            temporary.unlink(missing_ok=True)
            raise RuntimeError("Downloaded Qwen file is unexpectedly small")
        os.replace(temporary, target)

    def _run_cli(self, prompt: str, fact_ids: tuple[str, ...] = ()) -> str:
        prompt_file = None
        self._last_prompt_chars = len(prompt)
        try:
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".txt", delete=False) as handle:
                handle.write(prompt)
                prompt_file = handle.name
            command = [
                str(self.settings.llama_cli_path),
                "--model",
                str(self.settings.qwen_model_path),
                "--ctx-size",
                str(self.settings.qwen_context_size),
                "--n-predict",
                str(self.settings.qwen_max_tokens),
                "--temp",
                str(self.settings.qwen_temperature),
                "--top-p",
                str(self.settings.qwen_top_p),
                "--reasoning-budget",
                str(self.settings.qwen_reasoning_budget),
                "--reasoning",
                "off",
                "--threads",
                str(self.settings.qwen_threads),
                "--threads-batch",
                str(self.settings.qwen_batch_threads),
                "--json-schema",
                json.dumps(self._output_schema(fact_ids), separators=(",", ":")),
                "--conversation",
                "--single-turn",
                "--no-warmup",
                "--log-disable",
                "--no-show-timings",
                "--no-display-prompt",
                "--simple-io",
                "--file",
                prompt_file,
            ]
            started = time.monotonic()
            try:
                completed = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=self.settings.qwen_timeout_seconds - 2,
                    check=False,
                )
            finally:
                self._last_generation_seconds = round(time.monotonic() - started, 2)
        finally:
            if prompt_file:
                try:
                    os.unlink(prompt_file)
                except OSError:
                    pass
        if completed.returncode != 0:
            error = completed.stderr.strip().splitlines()[-1:] or ["unknown llama-cli error"]
            raise RuntimeError(f"Qwen inference failed: {error[0]}")
        answer = self._extract_answer(completed.stdout)
        if not answer:
            raise RuntimeError("Qwen returned an empty coaching explanation")
        self._last_output_chars = len(answer)
        return answer

    @staticmethod
    def _output_schema(fact_ids: tuple[str, ...]) -> dict[str, object]:
        allowed = sorted(set(fact_ids))
        fact_id_items: dict[str, object] = {"type": "string"}
        if allowed:
            fact_id_items["enum"] = allowed
        section = {
            "type": "object",
            "properties": {
                "fact_ids": {
                    "type": "array",
                    "items": fact_id_items,
                    "maxItems": 6 if allowed else 0,
                },
                "explanation": {"type": "string", "maxLength": 240},
            },
            "required": ["fact_ids", "explanation"],
            "additionalProperties": False,
        }
        return {
            "type": "object",
            "properties": {name: section for name in ("summary", "board_a", "board_b", "team_plan")},
            "required": ["summary", "board_a", "board_b", "team_plan"],
            "additionalProperties": False,
        }

    @staticmethod
    def _extract_answer(output: str) -> str:
        summary = re.search(r"(?im)^(?:#{1,6}\s*)?Summary\s*:?[ \t]*$", output)
        answer = output[summary.start() :] if summary else output
        answer = re.split(r"(?m)^\[ Prompt:|^Exiting\.\.\.$", answer, maxsplit=1)[0]
        return answer.strip()
