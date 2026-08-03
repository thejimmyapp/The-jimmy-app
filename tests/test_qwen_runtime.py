import json
from types import SimpleNamespace

from backend.config import Settings
from backend.qwen_runtime import QwenRuntime


def test_extract_answer_removes_cli_banner_prompt_and_timings() -> None:
    output = """Loading model...
available commands:
> long prompt (truncated)

### Summary
Validated explanation.

### Urgency
Normal.

[ Prompt: 52.5 t/s | Generation: 5.1 t/s ]
Exiting...
"""

    assert QwenRuntime._extract_answer(output) == """### Summary
Validated explanation.

### Urgency
Normal."""


def test_status_reflects_model_and_runtime_files_on_every_request(tmp_path) -> None:
    model = tmp_path / "model.gguf"
    runtime = tmp_path / "llama-cli"
    model.touch()
    runtime.touch()
    qwen = QwenRuntime(Settings(qwen_model_path=model, llama_cli_path=runtime))

    ready = qwen.status()
    assert ready["state"] == "ready"
    assert ready["detail"] == "Model and local runtime are ready"

    model.unlink()
    missing = qwen.status()
    assert missing["state"] == "not_downloaded"
    assert missing["detail"] == "Model downloads on first use"


def test_cli_uses_schema_threads_and_one_shot_performance_flags(tmp_path, monkeypatch) -> None:
    model = tmp_path / "model.gguf"
    runtime = tmp_path / "llama-cli"
    model.touch()
    runtime.touch()
    captured: dict[str, object] = {}

    output = {
        section: {"fact_ids": ["board_a.best_move"], "explanation": "Use the cited fact."}
        for section in ("summary", "board_a", "board_b", "team_plan")
    }

    def fake_run(command, **kwargs):
        captured["command"] = command
        captured["kwargs"] = kwargs
        return SimpleNamespace(returncode=0, stdout=json.dumps(output), stderr="")

    monkeypatch.setattr("backend.qwen_runtime.subprocess.run", fake_run)
    qwen = QwenRuntime(Settings(
        qwen_model_path=model,
        llama_cli_path=runtime,
        qwen_threads=4,
        qwen_batch_threads=4,
    ))

    answer = qwen._run_cli("compact prompt", ("board_a.best_move",))
    command = captured["command"]
    assert isinstance(command, list)
    assert answer == json.dumps(output)
    assert command[command.index("--threads") + 1] == "4"
    assert command[command.index("--threads-batch") + 1] == "4"
    assert "--no-warmup" in command
    schema = json.loads(command[command.index("--json-schema") + 1])
    assert schema["additionalProperties"] is False
    fact_id_schema = schema["properties"]["summary"]["properties"]["fact_ids"]["items"]
    assert fact_id_schema["enum"] == ["board_a.best_move"]
    status = qwen.status()
    assert status["last_prompt_chars"] == len("compact prompt")
    assert status["last_output_chars"] == len(answer)
    assert status["last_generation_seconds"] is not None
