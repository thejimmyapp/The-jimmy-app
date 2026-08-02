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
