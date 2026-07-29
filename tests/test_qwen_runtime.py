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
