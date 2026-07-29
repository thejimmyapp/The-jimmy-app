from __future__ import annotations

import asyncio
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

    def status(self) -> dict[str, object]:
        model_exists = self.settings.qwen_model_path.is_file()
        binary_exists = self.settings.llama_cli_path.is_file()
        state = self._state
        if self.settings.qwen_enabled and model_exists and binary_exists and state not in {"running", "downloading"}:
            state = "ready"
        return {
            "enabled": self.settings.qwen_enabled,
            "state": state,
            "detail": self._detail,
            "model": self.settings.qwen_model_name,
            "model_file": self.settings.qwen_model_filename,
            "model_downloaded": model_exists,
            "runtime_available": binary_exists,
            "context_size": self.settings.qwen_context_size,
            "max_tokens": self.settings.qwen_max_tokens,
            "temperature": self.settings.qwen_temperature,
            "top_p": self.settings.qwen_top_p,
            "reasoning_budget": self.settings.qwen_reasoning_budget,
        }

    async def explain(self, prompt: str) -> str:
        if not self.settings.qwen_enabled:
            raise RuntimeError("Local Qwen coaching is disabled")
        async with self._lock:
            await self._ensure_model()
            self._state = "running"
            self._detail = "Qwen is explaining validated engine facts"
            try:
                return await asyncio.wait_for(
                    asyncio.to_thread(self._run_cli, prompt),
                    timeout=self.settings.qwen_timeout_seconds,
                )
            finally:
                self._state = "ready"
                self._detail = "Model ready; RAM released after the request"

    async def _ensure_model(self) -> None:
        if self.settings.qwen_model_path.is_file():
            return
        if not self.settings.llama_cli_path.is_file():
            raise RuntimeError(f"llama-cli not found: {self.settings.llama_cli_path}")
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

    def _run_cli(self, prompt: str) -> str:
        prompt_file = None
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
                "--conversation",
                "--single-turn",
                "--log-disable",
                "--no-show-timings",
                "--no-display-prompt",
                "--simple-io",
                "--file",
                prompt_file,
            ]
            started = time.monotonic()
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
        return answer + f"\n\n[Generated locally in {time.monotonic() - started:.1f}s]"

    @staticmethod
    def _extract_answer(output: str) -> str:
        summary = re.search(r"(?im)^(?:#{1,6}\s*)?Summary\s*:?[ \t]*$", output)
        answer = output[summary.start() :] if summary else output
        answer = re.split(r"(?m)^\[ Prompt:|^Exiting\.\.\.$", answer, maxsplit=1)[0]
        return answer.strip()
