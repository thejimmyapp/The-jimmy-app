from __future__ import annotations

import json
import re
from typing import Any


SECTIONS = ("summary", "board_a", "board_b", "team_plan")
RAW_FACT_PATTERNS = (
    (re.compile(r"(?i)\b(?:[a-h][1-8][a-h][1-8][qrbn]?|[pnbrqk]@[a-h][1-8])\b"), "raw move"),
    (re.compile(r"(?<![A-Za-z0-9])(?:O-O(?:-O)?|[KQRBN]?[a-h](?:x[a-h])?[1-8](?:=[QRBN])?[+#]?)(?![A-Za-z0-9])"), "chess notation"),
    (re.compile(r"(?i)\b(?:send|transfer|add|give|request|ask\s+for)\w*\s+(?:an?\s+)?(?:pawn|knight|bishop|rook|queen)\b"), "piece-transfer claim"),
    (re.compile(r"(?i)\b(?:white|black)\s+to\s+move\b"), "side-to-move claim"),
    (re.compile(r"\b\d{1,2}:\d{2}\b"), "clock value"),
    (re.compile(r"(?i)\b-?\d+\s*cp\b"), "evaluation value"),
    (re.compile(r"(?i)\b(?:mate\s+in\s+\d+|m\d+)\b"), "mate value"),
    (re.compile(r"(?i)\b(?:critical|high|normal|unknown)\s+urgency\b"), "urgency label"),
)


def validate_and_render_coach_output(
    prepared: dict[str, object],
    raw_output: str,
) -> dict[str, object]:
    facts = prepared.get("facts") if isinstance(prepared.get("facts"), dict) else {}
    deterministic = render_deterministic_facts(facts)
    try:
        payload = _parse_json_object(raw_output)
        commentary, fact_ids = _validate_payload(payload, facts)
    except ValueError as exc:
        return {
            "answer": deterministic,
            "qwen_commentary": None,
            "validation": {
                "status": "rejected",
                "reasons": [str(exc)],
                "cited_fact_ids": [],
            },
        }
    return {
        "answer": f"{deterministic}\n\nQwen explanation\n{commentary}",
        "qwen_commentary": commentary,
        "validation": {
            "status": "passed",
            "reasons": [],
            "cited_fact_ids": fact_ids,
        },
    }


def render_deterministic_facts(facts: dict[str, object]) -> str:
    lines = [
        "Verified coaching facts",
        f"Position: stored completed-game replay at global ply {facts.get('global_ply', 0)}.",
    ]
    boards = facts.get("boards") if isinstance(facts.get("boards"), dict) else {}
    for board_id in ("A", "B"):
        board = boards.get(board_id) if isinstance(boards.get(board_id), dict) else {}
        if not board.get("available"):
            lines.append(f"Board {board_id}: unavailable; no position or recommendation was inferred.")
            continue
        details = [f"{board.get('side_to_move') or 'side unknown'} to move"]
        best_move = board.get("best_move")
        details.append(f"best move {best_move}" if best_move else "best move unavailable")
        if board.get("mate_in") is not None:
            details.append(f"Fairy-Stockfish mate signal {board['mate_in']}")
        elif board.get("score_cp") is not None:
            details.append(f"Fairy-Stockfish score {board['score_cp']} cp")
        else:
            details.append("evaluation unavailable")
        white_clock = board.get("white_clock") or "unavailable"
        black_clock = board.get("black_clock") or "unavailable"
        details.append(f"clocks White {white_clock}, Black {black_clock}")
        lines.append(f"Board {board_id}: " + "; ".join(str(item) for item in details) + ".")

    transfers = facts.get("transfers") if isinstance(facts.get("transfers"), list) else []
    if transfers:
        for transfer in transfers:
            if isinstance(transfer, dict):
                lines.append(
                    "Transfer: Board "
                    f"{transfer.get('board')} move {transfer.get('move')} — "
                    f"{transfer.get('partner_impact') or 'no verified transfer'}."
                )
    else:
        lines.append("Transfer: no capture-to-partner transfer is verified for the engine candidates.")

    missing = facts.get("missing_data") if isinstance(facts.get("missing_data"), list) else []
    lines.append("Missing data: " + (", ".join(str(item) for item in missing) if missing else "none") + ".")
    lines.append(f"Urgency: {facts.get('urgency') or 'unknown'} (deterministic engine/validator result).")
    return "\n".join(lines)


def _parse_json_object(raw_output: str) -> dict[str, Any]:
    start = raw_output.find("{")
    end = raw_output.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("Qwen did not return the required JSON object")
    try:
        payload = json.loads(raw_output[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ValueError("Qwen returned invalid JSON") from exc
    if not isinstance(payload, dict):
        raise ValueError("Qwen output was not a JSON object")
    return payload


def _validate_payload(
    payload: dict[str, Any],
    facts: dict[str, object],
) -> tuple[str, list[str]]:
    catalog = facts.get("catalog") if isinstance(facts.get("catalog"), dict) else {}
    commentary: list[str] = []
    cited: list[str] = []
    for section in SECTIONS:
        value = payload.get(section)
        if not isinstance(value, dict):
            raise ValueError(f"Qwen omitted structured section {section}")
        fact_ids = value.get("fact_ids")
        explanation = value.get("explanation")
        if not isinstance(fact_ids, list) or not all(isinstance(item, str) for item in fact_ids):
            raise ValueError(f"Qwen section {section} has invalid fact_ids")
        unknown = [item for item in fact_ids if item not in catalog]
        if unknown:
            raise ValueError(f"Qwen cited unknown fact id {unknown[0]}")
        if not isinstance(explanation, str) or len(explanation) > 1000:
            raise ValueError(f"Qwen section {section} has invalid explanation text")
        for pattern, label in RAW_FACT_PATTERNS:
            if pattern.search(explanation):
                raise ValueError(f"Qwen attempted to restate a {label}")
        clean = " ".join(explanation.split()).strip()
        if clean:
            commentary.append(f"{section.replace('_', ' ').title()}: {clean}")
        cited.extend(fact_ids)
    combined = "\n".join(commentary)
    combined_lower = combined.lower()
    missing = facts.get("missing_data") if isinstance(facts.get("missing_data"), list) else []
    if any("clock" in str(item).lower() for item in missing) and re.search(
        r"\b(?:no|without)\s+(?:critical\s+)?(?:time|clock)\s+pressure\b|\bplenty\s+of\s+time\b",
        combined_lower,
    ):
        raise ValueError("Qwen inferred time pressure despite missing clock data")
    boards = facts.get("boards") if isinstance(facts.get("boards"), dict) else {}
    board_b = boards.get("B") if isinstance(boards.get("B"), dict) else {}
    if not board_b.get("available") and re.search(
        r"\bboard\s+b\b.{0,60}\b(?:move|play|attack|defend|threat|best)\b",
        combined_lower,
    ):
        raise ValueError("Qwen inferred tactics for unavailable Board B")
    if len(combined.split()) > 180:
        raise ValueError("Qwen explanation exceeded the 180-word boundary")
    return combined or "No additional explanation was supplied.", list(dict.fromkeys(cited))
