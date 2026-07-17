from __future__ import annotations

import logging
import json
import time
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

from src.analyzer import analyze_critical_moments
from src.board_renderer import render_game_replay_html, render_pattern_puzzle_html
from src.bughouse_reconstructor import reconstruct_main_board
from src.chesscom_api import ChessComApiError, ChessComClient
from src.chesscom_pgn_info import PgnInfoClient, PgnInfoError, has_partner_board_data, merge_pgn_info
from src.db import Database
from src.engine import EngineConfig, EngineError
from src.opening_lab import analyze_opening_batch
from src.full_bughouse_discovery import BughouseDiscoveryReport, discover_full_bughouse_data
from src.phase4 import analyze_recent_games_for_mistakes, classify_bughouse_category
from src.pgn_parser import extract_critical_moments, format_seconds, parse_game_data, parse_partner_tcn, parse_pgn
from src.pattern_academy import categories as pattern_categories
from src.pattern_academy import get_puzzles, score_solution
from src.tactical_motifs import classify_tactical_motif


APP_DIR = Path(__file__).resolve().parent
DB_PATH = APP_DIR / "data" / "bughouse.db"
LOG_PATH = APP_DIR / "logs" / "app.log"
DEFAULT_PGN_INFO_PATH = APP_DIR / "secrets" / "chesscom_pgn_info_curl.txt"
DEFAULT_ENGINE_PATH = APP_DIR / "engines" / "fairy-stockfish.exe"
DEFAULT_ENGINE_DEPTH = 10

COACHING_TIPS = [
    "Good Bughouse improvement starts by finding the same mistake twice.",
    "When your partner is under attack, every trade can become a tactical gift.",
    "Speed is useful only when the position stays simple enough to play fast.",
    "A defensive king move can be stronger than a random attacking drop.",
    "Before sacrificing on f2 or f7, ask what piece your partner will receive.",
    "Drops near the king are strongest when they create two threats at once.",
    "Your best partner is not always the one you score highest with in one session; volume matters.",
    "In Bughouse, a safe move that gives your partner time can be a team tactic.",
]


def configure_logging() -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(LOG_PATH, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )


@st.cache_resource
def get_database() -> Database:
    db = Database(DB_PATH)
    db.initialize()
    return db


def render_metric_grid(stats: dict[str, object]) -> None:
    total_games = int(stats.get("total_games", 0))
    winrate = stats.get("winrate")
    avg_blunders = stats.get("average_blunders_per_game")
    losing_pattern = stats.get("most_common_losing_pattern")
    tactical_miss = stats.get("most_common_tactical_miss")
    time_trouble = stats.get("time_trouble_frequency")
    partner_boards = int(stats.get("partner_boards") or 0)

    cols = st.columns(3)
    cols[0].metric("Total games", total_games)
    cols[1].metric("Winrate", "N/A" if winrate is None else f"{winrate:.1f}%")
    cols[2].metric("Two-board games", f"{partner_boards}/{total_games}")

    cols = st.columns(3)
    cols[0].metric("Most common losing pattern", losing_pattern or "Not analyzed yet")
    cols[1].metric("Most common tactical miss", tactical_miss or "Not analyzed yet")
    cols[2].metric("Time trouble frequency", time_trouble or "Not analyzed yet")


def render_phase4_dashboard(db: Database, username: str) -> None:
    st.subheader("Coach analysis")
    summary = db.get_mistake_summary(username)
    cols = st.columns(3)
    cols[0].metric("Stored mistakes", int(summary.get("mistakes") or 0))
    cols[1].metric("Blunders", int(summary.get("blunders") or 0))
    avg_loss = summary.get("avg_loss")
    cols[2].metric("Avg loss", "N/A" if avg_loss is None else f"{avg_loss} cp")

    priorities = db.get_coaching_priorities(username)
    if priorities:
        st.caption("Current coaching priorities")
        st.dataframe(priorities, use_container_width=True, hide_index=True)

    category_rows = db.get_mistake_category_stats(username)
    mistake_rows = db.get_mistake_rows(username, limit=100)
    if not mistake_rows:
        st.info("No coach analysis stored yet. Run an analysis batch from the sidebar.")
        return

    tabs = st.tabs(["Mistake patterns", "Context insights", "Training board"])
    with tabs[0]:
        render_session_report(db, username)
        st.divider()
        filtered_rows = render_mistake_filters(db, username)
        if category_rows:
            st.caption("Most frequent mistake patterns.")
            st.dataframe(category_rows, use_container_width=True, hide_index=True)
        motif_rows = db.get_tactical_motif_stats(username)
        if motif_rows:
            st.caption("Tactical motifs")
            st.dataframe(motif_rows, use_container_width=True, hide_index=True)
        st.caption("Filtered mistakes")
        st.dataframe(filtered_rows, use_container_width=True, hide_index=True)

    with tabs[1]:
        context_tabs = st.tabs(["Partner", "Opponent", "Rating", "Clock", "Result"])
        with context_tabs[0]:
            _render_context_table("Mistakes by partner", db.get_mistake_partner_stats(username))
        with context_tabs[1]:
            _render_context_table("Mistakes by opponent", db.get_mistake_opponent_stats(username))
        with context_tabs[2]:
            _render_context_table("Mistakes by opponent rating", db.get_mistake_rating_bucket_stats(username))
        with context_tabs[3]:
            _render_context_table("Mistakes by clock remaining", db.get_mistake_clock_stats(username))
            st.caption("Clock rows show `unknown` for older mistakes. Re-run analysis batches to backfill clocks.")
        with context_tabs[4]:
            _render_context_table("Mistakes by game result", db.get_mistake_result_stats(username))

    with tabs[2]:
        render_mistake_drill(db, username)


def render_opening_lab(db: Database, username: str, engine_depth: int) -> None:
    st.subheader("Opening Lab")
    coverage = db.get_opening_coverage(username, engine_depth)
    st.caption(
        f"Analyzed at depth {engine_depth}: "
        f"{coverage.get('analyzed_games', 0)} games, "
        f"{coverage.get('analyzed_moves', 0)} opening decisions."
    )
    opponents = ["All opponents"] + db.get_opening_opponents(username, engine_depth, min_positions=3)
    control_cols = st.columns([2, 1])
    selected_opponent = control_cols[0].selectbox("Opponent prep", opponents)
    line_limit = control_cols[1].number_input("Opening lines", min_value=10, max_value=100, value=30, step=10)
    line_rows = db.get_opening_line_stats(
        username,
        engine_depth,
        limit=int(line_limit),
        opponent=selected_opponent,
    )
    if not line_rows:
        st.info("No opening analysis stored for this opponent yet. Run an Opening Lab batch from the sidebar.")
        return

    cols = st.columns([2, 1])
    with cols[0]:
        caption = "Most frequent opening positions before your move"
        if selected_opponent != "All opponents":
            caption += f" vs {selected_opponent}"
        st.caption(caption)
        st.dataframe(line_rows, use_container_width=True, hide_index=True)
    line_labels = [
        f"{row.get('positions')}x | {row.get('line_label')}"
        for row in line_rows
    ]
    selected_label = cols[1].selectbox("Study line", line_labels)
    selected_index = line_labels.index(selected_label)
    selected_line = line_rows[selected_index]
    move_rows = db.get_opening_move_stats(
        username=username,
        depth=engine_depth,
        line_key=str(selected_line.get("line_key") or ""),
        limit=100,
        opponent=selected_opponent,
    )
    reply_caption = "Your most common replies in this position"
    if selected_opponent != "All opponents":
        reply_caption += f" vs {selected_opponent}"
    st.caption(reply_caption)
    st.dataframe(move_rows, use_container_width=True, hide_index=True)

    if not move_rows:
        return
    sample = move_rows[0]
    game = db.get_game(int(sample.get("sample_game_id") or 0))
    if not game:
        return
    suggestions = [
        {
            "ply": max(0, int(row.get("ply") or 0) - 1),
            "bestmove": row.get("bestmove"),
            "move": row.get("played_move"),
            "reason": row.get("quality"),
        }
        for row in db.get_opening_game_suggestions(
            game_id=int(game["id"]),
            username=username,
            depth=engine_depth,
        )
        if row.get("bestmove")
    ]
    parsed = parse_game_data(str(game.get("pgn") or ""), str(game.get("raw_json") or ""))
    partner = parse_partner_tcn(str(game.get("raw_json") or ""))
    selected_ply = max(0, int(sample.get("sample_ply") or 0) - 1)
    st.caption("Replay sample with Fairy-Stockfish opening best moves highlighted")
    components.html(
        render_game_replay_html(
            parsed.moves,
            critical=[],
            partner_moves=partner.moves if partner else None,
            engine_suggestions=suggestions,
            player_labels=player_labels_for_game(game),
            selected_ply=selected_ply,
            orientation=str(game.get("user_color") or "white"),
            title="Opening Lab",
        ),
        height=760,
        scrolling=True,
    )


def render_pattern_academy(db: Database, username: str) -> None:
    st.subheader("Pattern Academy")
    st.caption("Train recurring Bughouse patterns until the correct move becomes automatic.")
    summary = db.get_pattern_summary(username)
    metrics = st.columns(5)
    metrics[0].metric("Studied", summary.get("studied", 0))
    metrics[1].metric("Attempts", summary.get("attempts", 0))
    metrics[2].metric("Accuracy", "N/A" if summary.get("accuracy") is None else f"{summary['accuracy']}%")
    metrics[3].metric("Mastered", summary.get("mastered", 0))
    metrics[4].metric("Due now", summary.get("due", 0))

    progress = db.get_pattern_progress(username)
    controls = st.columns([2, 2, 1])
    category = controls[0].selectbox("Pattern category", ["All"] + pattern_categories())
    queue_mode = controls[1].selectbox("Practice mode", ["Due now", "Weak first", "All patterns"])
    difficulty = controls[2].selectbox("Difficulty", ["All", 1, 2, 3])
    puzzles = get_puzzles(category=category, difficulty=None if difficulty == "All" else int(difficulty))
    now = datetime.now(UTC)

    def due(puzzle_id: str) -> bool:
        row = progress.get(puzzle_id)
        if not row:
            return True
        raw = str(row.get("next_due") or "")
        try:
            parsed = datetime.fromisoformat(raw.replace(" ", "T"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=UTC)
            return parsed <= now
        except ValueError:
            return True

    if queue_mode == "Due now":
        puzzles = [puzzle for puzzle in puzzles if due(puzzle.id)]
    if queue_mode == "Weak first":
        puzzles.sort(key=lambda puzzle: (int(progress.get(puzzle.id, {}).get("mastery") or 0), int(progress.get(puzzle.id, {}).get("correct") or 0)))
    else:
        puzzles.sort(key=lambda puzzle: (puzzle.category, puzzle.difficulty, puzzle.title))

    if not puzzles:
        st.success("Nothing is due in this filter. Switch to All patterns or choose another category.")
        return

    state_key = "pattern_academy_index"
    st.session_state[state_key] = max(0, min(int(st.session_state.get(state_key, 0)), len(puzzles) - 1))
    nav = st.columns([1, 1, 2, 6])
    if nav[0].button("< Previous", key="pattern_previous", disabled=st.session_state[state_key] <= 0):
        st.session_state[state_key] -= 1
    if nav[1].button("Next >", key="pattern_next", disabled=st.session_state[state_key] >= len(puzzles) - 1):
        st.session_state[state_key] += 1
    nav[2].caption(f"{st.session_state[state_key] + 1} / {len(puzzles)}")

    labels = [f"{puzzle.motif} | {puzzle.title}" for puzzle in puzzles]
    selected_label = st.selectbox("Puzzle", labels, index=st.session_state[state_key])
    selected_index = labels.index(selected_label)
    if selected_index != st.session_state[state_key]:
        st.session_state[state_key] = selected_index
    puzzle = puzzles[st.session_state[state_key]]
    puzzle_progress = progress.get(puzzle.id, {})

    info = st.columns(4)
    info[0].metric("Motif", puzzle.motif)
    info[1].metric("Difficulty", puzzle.difficulty)
    info[2].metric("Mastery", f"{puzzle_progress.get('mastery', 0)}/5")
    info[3].metric("Streak", puzzle_progress.get("streak", 0))
    st.write(puzzle.prompt)

    attempt_key = f"pattern_attempt_{puzzle.id}"
    result_key = f"pattern_result_{puzzle.id}"
    reveal_key = f"pattern_reveal_{puzzle.id}"
    attempt = st.text_input("Your move", key=attempt_key, placeholder="Examples: N@f7, Q@h7, e2e4")
    actions = st.columns([1, 1, 1, 5])
    if actions[0].button("Check move", key=f"check_{puzzle.id}", disabled=not attempt.strip()):
        score = score_solution(attempt, puzzle)
        db.record_pattern_attempt(
            username=username,
            puzzle_id=puzzle.id,
            category=puzzle.category,
            motif=puzzle.motif,
            attempted_move=attempt.strip(),
            expected_move=puzzle.solutions[0],
            score=score,
        )
        st.session_state[result_key] = score
        if score == "correct":
            st.session_state[reveal_key] = True
    if actions[1].button("Clear", key=f"clear_{puzzle.id}"):
        st.session_state[attempt_key] = ""
        st.session_state.pop(result_key, None)
        st.session_state[reveal_key] = False
    if actions[2].button("Reveal", key=f"reveal_{puzzle.id}"):
        st.session_state[reveal_key] = True

    if st.toggle("Show hint", key=f"hint_{puzzle.id}"):
        st.info(puzzle.hint)
    result = st.session_state.get(result_key)
    if result == "correct":
        st.success("Correct. Pattern recognized.")
    elif result == "close":
        st.warning("Close. You found the target square, but not the exact move.")
    elif result == "incorrect":
        st.error("Not yet. Look again or use the hint.")

    reveal = bool(st.session_state.get(reveal_key, False))
    components.html(
        render_pattern_puzzle_html(
            fen=puzzle.fen,
            orientation=puzzle.orientation,
            title=puzzle.title,
            solution=puzzle.solutions[0] if reveal else None,
        ),
        height=760,
        scrolling=True,
    )
    if reveal:
        st.success(f"Solution: {', '.join(puzzle.solutions)}")
        st.write(puzzle.explanation)
        st.caption(f"Recognition rule: {puzzle.follow_up}")

    motif_stats = db.get_pattern_motif_stats(username)
    if motif_stats:
        st.caption("Pattern mastery by motif")
        st.dataframe(motif_stats, use_container_width=True, hide_index=True)


def _render_context_table(title: str, rows: list[dict[str, object]]) -> None:
    st.caption(title)
    if not rows:
        st.info("No stored mistakes for this breakdown yet.")
        return
    st.dataframe(rows, use_container_width=True, hide_index=True)


def render_session_report(db: Database, username: str) -> None:
    report = db.get_session_report(username)
    st.caption("Session report")
    priorities = report.get("priorities") if isinstance(report.get("priorities"), list) else []
    if priorities:
        st.write("Focus of the day")
        st.dataframe(priorities[:1], use_container_width=True, hide_index=True)
    top_leaks = report.get("top_leaks") if isinstance(report.get("top_leaks"), list) else []
    if top_leaks:
        st.write("Top 3 leaks")
        st.dataframe(top_leaks, use_container_width=True, hide_index=True)
    review_positions = report.get("review_positions") if isinstance(report.get("review_positions"), list) else []
    if review_positions:
        st.write("5 positions to review")
        st.dataframe(review_positions, use_container_width=True, hide_index=True)


def render_mistake_filters(db: Database, username: str) -> list[dict[str, object]]:
    categories = ["All"] + db.get_mistake_categories(username)
    motifs = ["All"] + db.get_tactical_motifs(username)
    cols = st.columns([2, 2, 2, 1, 1, 1])
    category = cols[0].selectbox("Pattern filter", categories)
    motif = cols[1].selectbox("Tactical motif", motifs)
    partner = cols[2].text_input("Partner filter", "")
    min_rating = cols[3].number_input("Min rating", min_value=0, max_value=3000, value=0, step=100, key="mistake_min_rating")
    max_clock = cols[4].number_input("Max clock", min_value=0, max_value=180, value=0, step=5, key="mistake_max_clock")
    limit = cols[5].number_input("Mistakes", min_value=10, max_value=500, value=100, step=10, key="mistake_filter_limit")
    return db.search_mistakes(
        username=username,
        limit=int(limit),
        category=category,
        tactical_motif=motif,
        partner=partner.strip() or None,
        min_rating=None if int(min_rating) <= 0 else int(min_rating),
        max_clock_seconds=None if int(max_clock) <= 0 else int(max_clock),
    )


def refresh_coaching_labels(db: Database, username: str) -> int:
    rows = db.list_mistakes_for_category_refresh(username)
    updated = 0
    for row in rows:
        category = classify_bughouse_category(
            move=str(row.get("move") or ""),
            bestmove=row.get("bestmove") if isinstance(row.get("bestmove"), str) else None,
            reason=str(row.get("reason") or ""),
            clock_seconds=_optional_float(row.get("clock_seconds")),
            time_spent_seconds=_optional_float(row.get("time_spent_seconds")),
            partner_danger=row.get("partner_danger") if isinstance(row.get("partner_danger"), str) else None,
        )
        motif = classify_tactical_motif(
            before_fen=row.get("before_fen") if isinstance(row.get("before_fen"), str) else None,
            bestmove=row.get("bestmove") if isinstance(row.get("bestmove"), str) else None,
            played_move=str(row.get("move") or ""),
            reason=str(row.get("reason") or ""),
            category=category,
        )
        db.update_mistake_labels(int(row["id"]), category, motif)
        updated += 1
    return updated


def render_mistake_drill(db: Database, username: str) -> None:
    st.subheader("Training board")
    queue_cols = st.columns([2, 1, 3])
    queue_mode = queue_cols[0].selectbox(
        "Training queue",
        ["smart queue", "largest mistakes", "recent mistakes", "weak categories", "missed before"],
    )
    queue_limit = queue_cols[1].number_input("Queue size", min_value=10, max_value=500, value=100, step=10)
    queue_cols[2].caption("Smart queue prioritizes missed attempts, weak categories, unseen positions, recent games, and large losses.")
    categories = ["All"] + db.get_mistake_categories(username)
    motifs = ["All"] + db.get_tactical_motifs(username)
    filter_cols = st.columns([2, 2, 2, 1, 1])
    queue_category = filter_cols[0].selectbox("Drill pattern", categories, key="queue_category")
    queue_motif = filter_cols[1].selectbox("Drill motif", motifs, key="queue_motif")
    queue_partner = filter_cols[2].text_input("Drill partner", "", key="queue_partner")
    queue_min_rating = filter_cols[3].number_input("Drill min rating", min_value=0, max_value=3000, value=0, step=100)
    queue_max_clock = filter_cols[4].number_input("Drill max clock", min_value=0, max_value=180, value=0, step=5)
    mistake_rows = db.get_training_queue(
        username,
        limit=int(queue_limit),
        mode=str(queue_mode),
        category=queue_category,
        tactical_motif=queue_motif,
        partner=queue_partner.strip() or None,
        min_rating=None if int(queue_min_rating) <= 0 else int(queue_min_rating),
        max_clock_seconds=None if int(queue_max_clock) <= 0 else int(queue_max_clock),
    )
    label_rows = [
        (_mistake_label(row), int(row["id"]))
        for row in mistake_rows
        if row.get("id") is not None
    ]
    if not label_rows:
        return
    labels = [item[0] for item in label_rows]
    label_to_id = dict(label_rows)
    state_key = "training_mistake_index"
    st.session_state[state_key] = max(0, min(int(st.session_state.get(state_key, 0)), len(labels) - 1))

    nav_cols = st.columns([1, 1, 2, 6])
    if nav_cols[0].button("< Previous", disabled=st.session_state[state_key] <= 0):
        st.session_state[state_key] -= 1
    if nav_cols[1].button("Next >", disabled=st.session_state[state_key] >= len(labels) - 1):
        st.session_state[state_key] += 1
    nav_cols[2].caption(f"{st.session_state[state_key] + 1} / {len(labels)}")

    selected = st.selectbox(
        "Select a stored mistake",
        labels,
        index=st.session_state[state_key],
    )
    selected_index = labels.index(selected)
    if selected_index != st.session_state[state_key]:
        st.session_state[state_key] = selected_index
    mistake = db.get_mistake(label_to_id[selected])
    if not mistake:
        st.warning("Selected mistake could not be loaded.")
        return

    cols = st.columns(5)
    cols[0].metric("Game", f"#{mistake.get('game_id')}")
    cols[1].metric("Loss", f"{mistake.get('estimated_loss_cp')} cp")
    cols[2].metric("Severity", str(mistake.get("severity") or ""))
    cols[3].metric("Category", str(mistake.get("category") or ""))
    cols[4].metric("Bestmove", str(mistake.get("bestmove") or "?"))
    st.caption(f"Tactical motif: {mistake.get('tactical_motif') or 'unknown'}")
    if mistake.get("partner_danger"):
        st.warning(
            f"Partner board was critical here: {mistake.get('partner_danger')} "
            f"at partner ply {mistake.get('partner_ply')} "
            f"(score {mistake.get('partner_score_before') or 'unknown'})."
        )

    attempt_key = f"drill_attempt_{mistake.get('id')}"
    attempt = st.text_input("Your move", key=attempt_key, placeholder="e.g. N@f4 or e2e4")
    score_cols = st.columns([1, 1, 4])
    if score_cols[0].button("Check move", disabled=not attempt.strip()):
        score = score_drill_move(attempt, str(mistake.get("bestmove") or ""))
        db.record_drill_attempt(
            mistake_id=int(mistake["id"]),
            username=str(mistake.get("username") or ""),
            category=str(mistake.get("category") or "unknown"),
            expected_move=mistake.get("bestmove") if isinstance(mistake.get("bestmove"), str) else None,
            attempted_move=attempt.strip(),
            score=score,
        )
        if score == "correct":
            st.success("Correct. Clean hit.")
        elif score == "close":
            st.warning("Close: same destination/drop square, but not the exact engine move.")
        else:
            st.error("Incorrect. Reveal the bestmove, then replay the idea.")
    if score_cols[1].button("Clear"):
        st.session_state[attempt_key] = ""

    reveal = st.toggle("Reveal Fairy-Stockfish bestmove", value=False)
    pgn = str(mistake.get("pgn") or "")
    raw_json = str(mistake.get("raw_json") or "")
    parsed = parse_game_data(pgn, raw_json)
    partner_parsed = parse_partner_tcn(raw_json)
    ply = max(0, int(mistake.get("ply") or 0) - 1)
    suggestions = []
    if reveal and mistake.get("bestmove"):
        suggestions.append(
            {
                "ply": ply,
                "bestmove": mistake.get("bestmove"),
                "move": mistake.get("move"),
                "reason": mistake.get("reason"),
            }
        )

    st.caption(
        f"{mistake.get('played_at')} | {mistake.get('result')} vs {mistake.get('opponent')} "
        f"({mistake.get('opponent_rating')}) | partner {mistake.get('partner')} | move {mistake.get('move')}"
    )
    components.html(
        render_game_replay_html(
            moves=parsed.moves,
            critical=[],
            partner_moves=partner_parsed.moves if partner_parsed else None,
            engine_suggestions=suggestions,
            player_labels=player_labels_for_game(mistake),
            selected_ply=ply,
            orientation=str(mistake.get("user_color") or "white"),
            title="Mistake drill",
        ),
        height=820,
        scrolling=True,
    )
    if not reveal:
        st.info("Find the engine move on the board, then reveal it.")
    else:
        st.success(f"Fairy-Stockfish recommends: {mistake.get('bestmove')}")

    render_drill_stats(db, str(mistake.get("username") or ""))


def render_drill_stats(db: Database, username: str) -> None:
    if not username:
        return
    summary = db.get_drill_summary(username)
    if int(summary.get("attempts") or 0) == 0:
        return
    st.subheader("Drill score")
    cols = st.columns(4)
    cols[0].metric("Attempts", int(summary.get("attempts") or 0))
    cols[1].metric("Correct", int(summary.get("correct") or 0))
    cols[2].metric("Close", int(summary.get("close") or 0))
    accuracy = summary.get("accuracy")
    cols[3].metric("Accuracy", "N/A" if accuracy is None else f"{accuracy}%")
    stats = db.get_drill_category_stats(username)
    if stats:
        st.caption("Drill accuracy by category")
        st.dataframe(stats, use_container_width=True, hide_index=True)
    recent = db.get_recent_drill_attempts(username, limit=10)
    if recent:
        st.caption("Recent attempts")
        st.dataframe(recent, use_container_width=True, hide_index=True)


def score_drill_move(attempted: str, expected: str) -> str:
    attempt = _normalize_move_text(attempted)
    target = _normalize_move_text(expected)
    if not attempt or not target:
        return "incorrect"
    if attempt == target:
        return "correct"
    if _move_destination(attempt) and _move_destination(attempt) == _move_destination(target):
        return "close"
    return "incorrect"


def _normalize_move_text(value: str) -> str:
    return value.strip().replace(" ", "").replace("-", "").lower()


def _move_destination(value: str) -> str | None:
    if "@" in value:
        _, square = value.split("@", 1)
        return square[:2] if len(square) >= 2 else None
    if len(value) >= 4:
        return value[2:4]
    return None


def render_partner_stats(partner_rows: list[dict[str, object]]) -> None:
    st.subheader("Winrate by partner")
    if not partner_rows:
        st.info("No partner metadata found yet in imported Bughouse games.")
        return
    st.dataframe(partner_rows, use_container_width=True, hide_index=True)


def render_opponent_stats(opponent_rows: list[dict[str, object]]) -> None:
    st.subheader("Winrate by opponent")
    if not opponent_rows:
        st.info("No opponent metadata found yet in imported Bughouse games.")
        return
    st.dataframe(opponent_rows, use_container_width=True, hide_index=True)


def render_game_table(db: Database, username: str) -> list[dict[str, object]]:
    st.subheader("Imported Bughouse games")
    filters = st.columns([2, 2, 1, 1])
    opponent = filters[0].text_input("Filter opponent", "")
    partner = filters[1].text_input("Filter partner", "")
    result = filters[2].selectbox("Result", ["All", "win", "loss", "draw", "unknown"])
    limit = filters[3].number_input("Rows", min_value=10, max_value=500, value=100, step=10)

    rating_filters = st.columns([1, 1, 2])
    min_rating = rating_filters[0].number_input("Min opponent rating", min_value=0, max_value=4000, value=0, step=50)
    max_rating = rating_filters[1].number_input("Max opponent rating", min_value=0, max_value=4000, value=4000, step=50)
    rating_filters[2].caption("Leave rating range at 0-4000 to include all rated/unknown rows.")

    rows = db.list_games(
        username=username,
        opponent=opponent.strip() or None,
        partner=partner.strip() or None,
        min_opponent_rating=None if int(min_rating) <= 0 else int(min_rating),
        max_opponent_rating=None if int(max_rating) >= 4000 else int(max_rating),
        result=None if result == "All" else result,
        limit=int(limit),
    )
    if not rows:
        st.info("No games match the current filters.")
        return []

    st.dataframe(rows, use_container_width=True, hide_index=True)
    return rows


def render_game_viewer(db: Database, game_rows: list[dict[str, object]], engine_path: Path, engine_depth: int) -> None:
    st.subheader("Game viewer")
    if not game_rows:
        st.info("Import Bughouse games first, then select one here.")
        return

    options = {
        _game_label(row): int(row["id"])
        for row in game_rows
        if row.get("id") is not None
    }
    selected_label = st.selectbox("Select a game", list(options))
    game = db.get_game(options[selected_label])
    if not game:
        st.error("Selected game could not be loaded from SQLite.")
        return

    pgn = str(game.get("pgn") or "")
    raw_json = str(game.get("raw_json") or "")
    parsed = parse_game_data(pgn, raw_json)
    partner_parsed = parse_partner_tcn(raw_json)
    critical = extract_critical_moments(parsed)

    top = st.columns([2, 1, 1, 1])
    top[0].metric("Game", selected_label)
    top[1].metric("Moves parsed", len(parsed.moves))
    top[2].metric("Critical moments", len(critical))
    top[3].metric("Game result", parsed.result)
    st.caption(f"Move source: {parsed.source.upper()}")

    if parsed.parse_warnings:
        for warning in parsed.parse_warnings:
            st.warning(warning)

    tabs = st.tabs(["Critical moments", "Engine analysis", "Move list", "Board", "Raw data"])
    with tabs[0]:
        st.caption("Critical moments are decoded from PGN or Chess.com TCN. Use the Engine analysis tab for Fairy-Stockfish output.")
        if not critical:
            st.info("No heuristic critical moments found in this PGN.")
        else:
            st.dataframe(
                [
                    {
                        "ply": item.ply,
                        "move": item.move,
                        "side": item.color,
                        "reason": item.reason,
                        "confidence": item.confidence,
                        "detail": item.detail,
                    }
                    for item in critical
                ],
                use_container_width=True,
                hide_index=True,
            )

    with tabs[1]:
        st.caption("Phase 3: Fairy-Stockfish analyzes reconstructible critical positions only.")
        if not critical:
            st.info("No critical moments available to send to the engine.")
        else:
            critical_limit = min(30, len(critical))
            if critical_limit == 1:
                max_positions = 1
                st.caption("1 critical position available for analysis.")
            else:
                max_positions = st.slider(
                    "Max critical positions to analyze",
                    min_value=1,
                    max_value=critical_limit,
                    value=min(12, critical_limit),
                )
            st.write(f"Engine path: `{engine_path}`")
            if not engine_path.exists():
                st.warning(
                    "Fairy-Stockfish executable not found. Download the Windows Fairy-Stockfish binary, "
                    "place it at `engines/fairy-stockfish.exe`, or set the correct path in the sidebar."
                )
            if st.button("Analyze critical positions", disabled=not engine_path.exists()):
                config = EngineConfig(path=engine_path, depth=engine_depth)
                try:
                    with st.spinner("Analyzing critical positions with Fairy-Stockfish..."):
                        engine_rows = analyze_critical_moments(
                            db=db,
                            parsed=parsed,
                            moments=critical,
                            config=config,
                            max_positions=max_positions,
                        )
                    st.success(f"Analyzed {len(engine_rows)} critical position(s).")
                    st.dataframe(
                        [
                            {
                                "ply": row.ply,
                                "move": row.move,
                                "reason": row.reason,
                                "bestmove": row.bestmove or "",
                                "score before": row.score_before,
                                "score after": row.score_after,
                                "estimated cp loss": row.estimated_loss_cp,
                                "depth": row.depth,
                                "pv": row.pv,
                                "confidence": row.confidence,
                                "note": row.note,
                            }
                            for row in engine_rows
                        ],
                        use_container_width=True,
                        hide_index=True,
                    )
                    engine_critical = [
                        item
                        for item in critical
                        if any(row.ply == item.ply for row in engine_rows)
                    ]
                    engine_suggestions = [
                        {
                            "ply": max(0, row.ply - 1),
                            "bestmove": row.bestmove,
                            "move": row.move,
                            "reason": row.reason,
                        }
                        for row in engine_rows
                        if row.bestmove
                    ]
                    if engine_critical:
                        components.html(
                            render_game_replay_html(
                                moves=parsed.moves,
                                critical=engine_critical,
                                partner_moves=partner_parsed.moves if partner_parsed else None,
                                engine_suggestions=engine_suggestions,
                                player_labels=player_labels_for_game(game),
                                critical_ply_offset=-1,
                                selected_ply=max(0, engine_critical[0].ply - 1),
                                orientation=str(game.get("user_color") or "white"),
                                title="Critical replay",
                            ),
                            height=760,
                            scrolling=True,
                        )
                except EngineError as exc:
                    logging.exception("Engine analysis failed")
                    st.error(str(exc))
                except Exception as exc:
                    logging.exception("Unexpected engine analysis failure")
                    st.error(f"Unexpected engine analysis failure: {exc}")

    with tabs[2]:
        if not parsed.moves:
            st.info("No moves parsed.")
        else:
            st.dataframe(
                [
                    {
                        "ply": move.ply,
                        "move": move.display_move,
                        "clock": "" if move.clock_seconds is None else format_seconds(move.clock_seconds),
                        "spent": "" if move.time_spent_seconds is None else format_seconds(move.time_spent_seconds),
                        "drop": move.is_drop,
                        "capture": move.is_capture,
                        "check": move.is_check,
                        "mate": move.is_mate,
                        "comment": move.comment or "",
                    }
                    for move in parsed.moves
                ],
                use_container_width=True,
                hide_index=True,
            )

    with tabs[3]:
        if not parsed.moves:
            st.info("No moves available for reconstruction.")
        else:
            max_ply = len(parsed.moves)
            selected_ply = st.slider("Position after ply", min_value=0, max_value=max_ply, value=max_ply)
            snapshot = reconstruct_main_board(parsed.moves, until_ply=selected_ply)
            if snapshot.warning:
                st.warning(snapshot.warning)
            st.caption(f"Shown after: {snapshot.move}")
            st.caption(f"Reconstruction: {snapshot.reconstruction_mode} | confidence: {snapshot.confidence}")
            if snapshot.pocket_summary:
                st.caption(snapshot.pocket_summary)
            components.html(
                render_game_replay_html(
                    moves=parsed.moves,
                    critical=critical,
                    partner_moves=partner_parsed.moves if partner_parsed else None,
                    player_labels=player_labels_for_game(game),
                    selected_ply=selected_ply,
                    orientation=str(game.get("user_color") or "white"),
                    title="Your board",
                ),
                height=760,
                scrolling=True,
            )
            if snapshot.variant_fen:
                st.text_input("Bughouse/Crazyhouse FEN with pockets", snapshot.variant_fen)
            if snapshot.fen:
                st.text_input("Board-only FEN", snapshot.fen)
            if partner_parsed and partner_parsed.moves:
                st.success(f"Partner board loaded: {len(partner_parsed.moves)} half-moves from Chess.com pgn-info.")
            else:
                st.info(
                    "For Chess.com TCN games, drops are reconstructed by inferring missing pocket pieces when partner-board "
                    "capture data is unavailable. Engine analysis uses the pocket FEN, but low-confidence pocket states stay marked."
                )

    with tabs[4]:
        render_full_data_status(db, game)
        st.subheader("Stored raw data")
        if pgn:
            st.code(pgn, language="text")
        else:
            st.code(raw_json or "No PGN or raw JSON stored for this game.", language="json")


def fetch_games(username: str, pgn_info_curl_path: Path | None = None) -> None:
    client = ChessComClient()
    db = get_database()
    pgn_info_client: PgnInfoClient | None = None
    enrichment_errors: list[str] = []
    if pgn_info_curl_path and pgn_info_curl_path.exists():
        try:
            pgn_info_client = PgnInfoClient.from_curl_file(pgn_info_curl_path)
        except PgnInfoError as exc:
            enrichment_errors.append(str(exc))

    with st.spinner("Fetching monthly archives from Chess.com..."):
        archives = client.get_archives(username)

    imported = 0
    duplicates = 0
    skipped = 0
    failed_archives: list[str] = []
    progress = st.progress(0)

    for idx, archive_url in enumerate(archives, start=1):
        try:
            month_games = client.get_archive_games(archive_url)
            pgn_info_by_id = {}
            bughouse_games = [game for game in month_games if client.is_bughouse_game(game)]
            if pgn_info_client and bughouse_games:
                try:
                    pgn_info_by_id = pgn_info_client.fetch_for_games(bughouse_games)
                except PgnInfoError as exc:
                    enrichment_errors.append(f"{archive_url}: {exc}")
            for game in month_games:
                if not client.is_bughouse_game(game):
                    skipped += 1
                    continue
                game_id = _chesscom_game_id(game)
                if game_id:
                    game = merge_pgn_info(game, pgn_info_by_id.get(game_id))
                inserted = db.upsert_game(username, game)
                if inserted:
                    imported += 1
                else:
                    duplicates += 1
        except ChessComApiError as exc:
            logging.exception("Failed to import archive %s", archive_url)
            failed_archives.append(f"{archive_url}: {exc}")
        progress.progress(idx / len(archives) if archives else 1.0)

    db.record_import(username, len(archives), imported, duplicates, skipped, failed_archives)
    st.success(
        f"Import complete: {imported} new Bughouse games, "
        f"{duplicates} duplicates, {skipped} non-Bughouse games skipped."
    )
    if failed_archives:
        st.warning(f"{len(failed_archives)} archive(s) failed. See logs/app.log for details.")
    if enrichment_errors:
        st.warning(f"pgn-info enrichment had {len(enrichment_errors)} issue(s). See logs/app.log for details.")
        for item in enrichment_errors:
            logging.warning("pgn-info enrichment issue: %s", item)
    elif pgn_info_client:
        st.info("Authenticated pgn-info enrichment was enabled for this import.")


def enrich_existing_games(username: str, pgn_info_curl_path: Path, limit: int = 500) -> None:
    db = get_database()
    try:
        pgn_info_client = PgnInfoClient.from_curl_file(pgn_info_curl_path)
    except PgnInfoError as exc:
        st.error(str(exc))
        return

    games = db.list_games_for_pgn_info_enrichment(username, limit=limit)
    if not games:
        st.info("No imported games need pgn-info enrichment.")
        return

    enriched = 0
    failed = 0
    batch_size = 50
    progress = st.progress(0)
    for offset in range(0, len(games), batch_size):
        batch = games[offset : offset + batch_size]
        try:
            pgn_info_by_id = pgn_info_client.fetch_for_games(batch)
            for game in batch:
                game_id = _chesscom_game_id(game)
                merged = merge_pgn_info(game, pgn_info_by_id.get(game_id or ""))
                if has_partner_board_data(merged):
                    db.upsert_game(username, merged)
                    enriched += 1
        except PgnInfoError as exc:
            failed += len(batch)
            logging.warning("pgn-info enrichment batch failed: %s", exc)
        progress.progress(min(1.0, (offset + len(batch)) / len(games)))
        time.sleep(0.15)

    if enriched:
        st.success(f"Enriched {enriched} imported game(s) with partner-board data.")
    if failed:
        st.warning(f"{failed} game(s) could not be enriched. See logs/app.log for details.")


def enrich_phase2_dashboard_stats(db: Database, username: str, stats: dict[str, object]) -> dict[str, object]:
    if stats.get("time_trouble_frequency"):
        return stats
    pgns = db.list_game_pgns(username, limit=1000)
    if not pgns:
        stats["time_trouble_frequency"] = None
        return stats

    games_with_time_trouble = 0
    games_with_clocks = 0
    for pgn in pgns:
        parsed = parse_pgn(pgn)
        clocks = [move.clock_seconds for move in parsed.moves if move.clock_seconds is not None]
        if not clocks:
            continue
        games_with_clocks += 1
        if any(clock <= 30 for clock in clocks):
            games_with_time_trouble += 1

    if games_with_clocks == 0:
        stats["time_trouble_frequency"] = "No clocks"
    else:
        stats["time_trouble_frequency"] = f"{(games_with_time_trouble / games_with_clocks) * 100:.1f}%"
    return stats


def apply_app_theme() -> None:
    st.markdown(
        """
        <style>
        .block-container {
            padding-top: 2rem;
            padding-bottom: 3rem;
        }
        div[data-testid="stMetric"] {
            background: #111827;
            border: 1px solid #263244;
            border-radius: 10px;
            padding: 14px 16px;
        }
        div[data-testid="stMetric"] label {
            color: #b6c2d1;
        }
        .coach-landing {
            max-width: 760px;
            margin: 10vh auto 0 auto;
            text-align: center;
        }
        .coach-landing h1 {
            font-size: 3.4rem;
            line-height: 1.05;
            margin-bottom: .6rem;
        }
        .coach-landing p {
            color: #aeb8c7;
            font-size: 1.05rem;
            margin-bottom: 2rem;
        }
        .setup-card {
            background: #111827;
            border: 1px solid #263244;
            border-radius: 12px;
            padding: 18px 20px;
            margin-bottom: 16px;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_username_landing() -> str:
    st.markdown(
        """
        <div class="coach-landing">
            <h1>Bughouse Coach AI</h1>
            <p>Enter your Chess.com username. The app will prepare your games, enrich partner-board data when possible, and build your training dashboard.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    username = st.text_input(
        "Chess.com username",
        value=st.session_state.get("active_username", ""),
        placeholder="Your Chess.com username",
        label_visibility="collapsed",
        key="landing_username_input",
    ).strip()
    if username:
        st.session_state["active_username"] = username
        st.rerun()
    return username


def render_loading_tip(step_index: int) -> None:
    tip = COACHING_TIPS[step_index % len(COACHING_TIPS)]
    st.info(f"Coach tip: {tip}")


def run_guided_setup(db: Database, username: str, pgn_info_path: Path, engine_path: Path, engine_depth: int) -> None:
    normalized = username.lower()
    setup_key = f"setup_finished_{normalized}"
    stats = db.get_dashboard_stats(username)
    total_games = int(stats.get("total_games") or 0)
    pending_enrichment = db.count_games_to_enrich(username)

    if st.session_state.get(setup_key):
        return
    if total_games > 0 and pending_enrichment == 0:
        st.session_state[setup_key] = True
        return

    st.markdown(f"### Preparing your Bughouse coach for `{username}`")
    st.caption("You can leave this screen open. The dashboard will appear when the first setup pass is complete.")
    progress = st.progress(0)

    try:
        render_loading_tip(0)
        progress.progress(0.12, text="Loading your Chess.com Bughouse games...")
        if total_games == 0:
            fetch_games(username, pgn_info_path if pgn_info_path.exists() else None)

        pending_enrichment = db.count_games_to_enrich(username)
        if pending_enrichment and pgn_info_path.exists():
            render_loading_tip(1)
            progress.progress(0.42, text="Enriching games with partner-board data...")
            safety_batches = 0
            while db.count_games_to_enrich(username) > 0 and safety_batches < 20:
                before_pending = db.count_games_to_enrich(username)
                enrich_existing_games(username, pgn_info_path, limit=5000)
                after_pending = db.count_games_to_enrich(username)
                safety_batches += 1
                if after_pending >= before_pending:
                    st.info("No additional partner-board data was found in this batch. The app will continue with the data already available.")
                    break
        elif pending_enrichment:
            st.warning(
                "Partner-board enrichment is not available yet because the Chess.com pgn-info cURL file was not found. "
                "You can add it later in Advanced settings."
            )

        progress.progress(0.72, text="Building your first coaching signals...")
        if engine_path.exists():
            coverage = db.get_analysis_coverage(username, engine_depth)
            if int(coverage.get("analyzed_at_depth") or 0) == 0:
                render_loading_tip(2)
                analyze_recent_games_for_mistakes(
                    db=db,
                    username=username,
                    engine_path=engine_path,
                    engine_depth=engine_depth,
                    game_limit=20,
                    max_positions_per_game=8,
                    only_two_board=True,
                    only_unanalyzed=True,
                    selection="recent",
                )
            opening_coverage = db.get_opening_coverage(username, engine_depth)
            if int(opening_coverage.get("analyzed_games") or 0) == 0:
                render_loading_tip(3)
                analyze_opening_batch(
                    db=db,
                    username=username,
                    engine_path=engine_path,
                    engine_depth=engine_depth,
                    game_limit=30,
                    opening_plies=16,
                    only_two_board=True,
                    only_unanalyzed=True,
                    selection="recent",
                )
        else:
            st.warning("Fairy-Stockfish was not found, so engine coaching will be skipped for now.")

        progress.progress(1.0, text="Your dashboard is ready.")
        st.session_state[setup_key] = True
        time.sleep(0.5)
        st.rerun()
    except ChessComApiError as exc:
        logging.exception("Guided setup import failed")
        st.error(f"Chess.com import failed: {exc}")
        st.session_state[setup_key] = True
    except Exception as exc:
        logging.exception("Guided setup failed")
        st.error(f"Setup could not finish automatically: {exc}")
        st.session_state[setup_key] = True


def best_row(rows: list[dict[str, object]], name_key: str, min_games: int = 3) -> dict[str, object] | None:
    candidates = [
        row for row in rows
        if int(row.get("games") or 0) >= min_games
        and str(row.get(name_key) or "").lower() != "unknown"
        and row.get("winrate") is not None
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda row: float(row.get("winrate") or 0))


def worst_row(rows: list[dict[str, object]], name_key: str, min_games: int = 3) -> dict[str, object] | None:
    candidates = [
        row for row in rows
        if int(row.get("games") or 0) >= min_games
        and str(row.get(name_key) or "").lower() != "unknown"
        and row.get("winrate") is not None
    ]
    if not candidates:
        return None
    return min(candidates, key=lambda row: float(row.get("winrate") or 100))


def render_statistics_tab(db: Database, username: str) -> None:
    stats = enrich_phase2_dashboard_stats(db, username, db.get_dashboard_stats(username))
    partner_rows = db.get_partner_stats(username)
    opponent_rows = db.get_opponent_stats(username, min_games=3)
    color_rows = db.get_color_stats(username)

    render_metric_grid(stats)
    st.subheader("Quick insights")
    best_partner = best_row(partner_rows, "partner")
    dangerous_opponent = worst_row(opponent_rows, "opponent")
    best_color = best_row(color_rows, "color", min_games=1)
    color_lookup = {str(row.get("color")): row for row in color_rows}

    cols = st.columns(4)
    cols[0].metric(
        "Best partner",
        "N/A" if not best_partner else str(best_partner.get("partner")),
        "" if not best_partner else f"{best_partner.get('winrate')}% over {best_partner.get('games')} games",
    )
    cols[1].metric(
        "Most dangerous opponent",
        "N/A" if not dangerous_opponent else str(dangerous_opponent.get("opponent")),
        "" if not dangerous_opponent else f"{dangerous_opponent.get('winrate')}% over {dangerous_opponent.get('games')} games",
    )
    cols[2].metric(
        "White winrate",
        "N/A" if "white" not in color_lookup else f"{color_lookup['white'].get('winrate')}%",
    )
    cols[3].metric(
        "Black winrate",
        "N/A" if "black" not in color_lookup else f"{color_lookup['black'].get('winrate')}%",
    )
    if best_color:
        st.caption(f"Your strongest color so far is {best_color.get('color')} across {best_color.get('games')} games.")

    table_tabs = st.tabs(["Partners", "Opponents", "Mistake patterns", "Color split"])
    with table_tabs[0]:
        render_partner_stats(partner_rows)
    with table_tabs[1]:
        render_opponent_stats(opponent_rows)
    with table_tabs[2]:
        category_rows = db.get_mistake_category_stats(username)
        motif_rows = db.get_tactical_motif_stats(username)
        if category_rows:
            st.caption("Repeated Bughouse leaks")
            st.dataframe(category_rows, use_container_width=True, hide_index=True)
        else:
            st.info("No stored coach mistakes yet. The app will fill this after engine analysis.")
        if motif_rows:
            st.caption("Tactical motifs")
            st.dataframe(motif_rows, use_container_width=True, hide_index=True)
    with table_tabs[3]:
        if color_rows:
            st.dataframe(color_rows, use_container_width=True, hide_index=True)
        else:
            st.info("No color split available yet.")


def render_training_tab(db: Database, username: str) -> None:
    summary = db.get_mistake_summary(username)
    cols = st.columns(3)
    cols[0].metric("Training positions", int(summary.get("mistakes") or 0))
    cols[1].metric("Blunders", int(summary.get("blunders") or 0))
    avg_loss = summary.get("avg_loss")
    cols[2].metric("Average loss", "N/A" if avg_loss is None else f"{avg_loss} cp")
    render_session_report(db, username)
    st.divider()
    render_mistake_drill(db, username)


def render_advanced_sidebar(db: Database, username: str) -> tuple[Path, int, Path]:
    with st.sidebar:
        st.header("Player")
        st.write(f"Studying: `{username}`")
        if st.button("Change player"):
            st.session_state.pop("active_username", None)
            st.rerun()

        st.divider()
        st.header("Coach setup")
        engine_depth = st.slider("Engine strength", min_value=4, max_value=18, value=DEFAULT_ENGINE_DEPTH)

        with st.expander("Advanced paths and maintenance"):
            pgn_info_path_text = st.text_input(
                "Chess.com pgn-info cURL file",
                str(DEFAULT_PGN_INFO_PATH),
                help="Optional but recommended: enables partner-board enrichment from your authenticated Chess.com session.",
            )
            engine_path_text = st.text_input("Fairy-Stockfish path", str(DEFAULT_ENGINE_PATH))
            st.write(f"Database: `{DB_PATH}`")
            st.write(f"Logs: `{LOG_PATH}`")
        pgn_info_path = Path(pgn_info_path_text)
        engine_path = Path(engine_path_text)

        with st.expander("Refresh game data"):
            if st.button("Fetch latest games"):
                try:
                    fetch_games(username, pgn_info_path if pgn_info_path.exists() else None)
                except ChessComApiError as exc:
                    logging.exception("Chess.com import failed")
                    st.error(str(exc))
                except Exception as exc:
                    logging.exception("Unexpected import failure")
                    st.error(f"Unexpected import failure: {exc}")
            pending = db.count_games_to_enrich(username)
            st.caption(f"Games still needing partner-board enrichment: {pending}")
            if st.button("Enrich partner boards", disabled=not pgn_info_path.exists()):
                enrich_existing_games(username, pgn_info_path, limit=5000)

        with st.expander("Run more coach analysis"):
            analysis_coverage = db.get_analysis_coverage(username, int(engine_depth))
            st.caption(
                f"Analyzed at depth {engine_depth}: "
                f"{analysis_coverage.get('analyzed_at_depth', 0)} / "
                f"{analysis_coverage.get('two_board_games', 0)} two-board games"
            )
            phase4_games = st.number_input("Games per batch", min_value=1, max_value=100, value=25, step=5)
            phase4_positions = st.number_input("Positions per game", min_value=1, max_value=30, value=8, step=1)
            phase4_selection = st.selectbox("Game selection", ["recent", "oldest", "random"])
            phase4_two_board = st.checkbox("Require two-board data", value=True)
            phase4_skip_done = st.checkbox("Skip already analyzed games", value=True)
            if st.button("Analyze more games"):
                if not engine_path.exists():
                    st.error("Fairy-Stockfish executable not found. Check the engine path above.")
                else:
                    with st.spinner("Analyzing games with Fairy-Stockfish..."):
                        batch = analyze_recent_games_for_mistakes(
                            db=db,
                            username=username,
                            engine_path=engine_path,
                            engine_depth=int(engine_depth),
                            game_limit=int(phase4_games),
                            max_positions_per_game=int(phase4_positions),
                            only_two_board=bool(phase4_two_board),
                            only_unanalyzed=bool(phase4_skip_done),
                            selection=str(phase4_selection),
                        )
                    st.success(f"Stored {batch.stored_mistakes} mistake(s) from {batch.games_seen} game(s).")

        with st.expander("Opening Lab analysis"):
            opening_coverage = db.get_opening_coverage(username, int(engine_depth))
            st.caption(
                f"Analyzed at depth {engine_depth}: "
                f"{opening_coverage.get('analyzed_games', 0)} games, "
                f"{opening_coverage.get('analyzed_moves', 0)} moves"
            )
            opening_games = st.number_input("Opening games per batch", min_value=1, max_value=200, value=50, step=10)
            opening_plies = st.number_input("Opening half-moves", min_value=4, max_value=40, value=16, step=2)
            opening_selection = st.selectbox("Opening game selection", ["recent", "oldest", "random"])
            if st.button("Analyze openings"):
                if not engine_path.exists():
                    st.error("Fairy-Stockfish executable not found. Check the engine path above.")
                else:
                    with st.spinner("Analyzing opening decisions..."):
                        batch = analyze_opening_batch(
                            db=db,
                            username=username,
                            engine_path=engine_path,
                            engine_depth=int(engine_depth),
                            game_limit=int(opening_games),
                            opening_plies=int(opening_plies),
                            only_two_board=True,
                            only_unanalyzed=True,
                            selection=str(opening_selection),
                        )
                    st.success(f"Analyzed {batch.analyzed_moves} opening decision(s).")

    return engine_path, int(engine_depth), pgn_info_path


def main() -> None:
    configure_logging()
    st.set_page_config(page_title="Bughouse Coach AI", layout="wide")
    apply_app_theme()

    db = get_database()
    username = str(st.session_state.get("active_username") or "").strip()

    if not username:
        render_username_landing()
        return

    engine_path, engine_depth, pgn_info_path = render_advanced_sidebar(db, username)
    run_guided_setup(db, username, pgn_info_path, engine_path, engine_depth)

    st.title("Bughouse Coach AI")
    st.caption("Your personal Bughouse dashboard, training board, opening lab, and partner review.")

    tabs = st.tabs(["Statistics", "Training Board", "Pattern Academy", "Opening Lab", "Games"])
    with tabs[0]:
        render_statistics_tab(db, username)
    with tabs[1]:
        render_training_tab(db, username)
    with tabs[2]:
        render_pattern_academy(db, username)
    with tabs[3]:
        render_opening_lab(db, username, int(engine_depth))
    with tabs[4]:
        game_rows = render_game_table(db, username)
        render_game_viewer(db, game_rows, engine_path, int(engine_depth))


def _game_label(row: dict[str, object]) -> str:
    played_at = row.get("played_at") or "unknown date"
    opponent = row.get("opponent") or "unknown opponent"
    result = row.get("result") or "unknown"
    time_control = row.get("time_control") or "?"
    return f"#{row.get('id')} | {played_at} | {result} vs {opponent} | {time_control}"


def _mistake_label(row: dict[str, object]) -> str:
    played_at = row.get("played_at") or "unknown date"
    opponent = row.get("opponent") or "unknown opponent"
    partner = row.get("partner") or "unknown partner"
    loss = row.get("estimated_loss_cp") or "?"
    move = row.get("move") or "?"
    severity = row.get("severity") or "?"
    category = row.get("category") or "?"
    motif = row.get("tactical_motif") or "unknown motif"
    return f"#{row.get('id')} | {loss}cp {severity} | {move} | vs {opponent} | partner {partner} | {played_at} | {category} | {motif}"


def render_full_data_status(db: Database, game: dict[str, object]) -> None:
    st.subheader("Full Bughouse Data")
    st.caption(
        "Automatic enrichment checks public Chess.com sources for partner-board clues. "
        "Results are cached per game."
    )
    game_id = int(game.get("id") or 0)
    cached = db.get_full_data_discovery(game_id)
    report: BughouseDiscoveryReport | None = None
    if cached:
        try:
            payload = json.loads(str(cached["report_json"]))
            report = _report_from_payload(payload)
        except Exception:
            report = None

    raw = _raw_game_dict(game)
    if has_partner_board_data(raw) and (
        report is None or report.conclusion != "authenticated_pgn_info_partner_board_found"
    ):
        report = BughouseDiscoveryReport(
            game_id=game_id,
            game_url=str(game.get("url") or ""),
            known_players=[],
            candidates=[],
            sources=[],
            conclusion="authenticated_pgn_info_partner_board_found",
            partner_found=str(game.get("partner") or ""),
            second_board_url=None,
        )
        db.set_full_data_discovery(
            game_id=game_id,
            conclusion=report.conclusion,
            partner_found=report.partner_found,
            second_board_url=report.second_board_url,
            report_json=json.dumps(asdict(report), ensure_ascii=False),
        )

    if report is None:
        try:
            with st.spinner("Auto-checking Chess.com public archive/page sources for this game..."):
                report = discover_full_bughouse_data(game)
            db.set_full_data_discovery(
                game_id=game_id,
                conclusion=report.conclusion,
                partner_found=report.partner_found,
                second_board_url=report.second_board_url,
                report_json=json.dumps(asdict(report), ensure_ascii=False),
            )
        except Exception as exc:
            logging.exception("Automatic full Bughouse data discovery failed")
            st.warning(f"Automatic full-data check failed: {exc}")
            return

    st.write(f"Conclusion: `{report.conclusion}`")
    if report.partner_found:
        st.success(f"Partner candidate found: {report.partner_found}")
    if report.second_board_url:
        st.success(f"Possible second board: {report.second_board_url}")
    if not report.partner_found and not report.second_board_url:
        st.warning(
            "No partner board was found in the public sources checked for this game. "
            "The app will continue with single-board reconstruction plus inferred pockets."
        )
    st.dataframe(
        [
            {
                "source": item.name,
                "status": item.status,
                "detail": item.detail,
                "url": item.url,
                "evidence": item.evidence,
            }
            for item in report.sources
        ],
        use_container_width=True,
        hide_index=True,
    )
    if report.candidates:
        st.caption("Current-board or near-time archive records checked during automatic enrichment.")
        st.dataframe(report.candidates, use_container_width=True, hide_index=True)


def _chesscom_game_id(game: dict[str, object]) -> str | None:
    import re

    for key in ("game_id", "gameId", "id"):
        value = game.get(key)
        if value is not None:
            return str(value)
    match = re.search(r"/(?:live|daily)/(\d+)", str(game.get("url") or ""))
    return match.group(1) if match else None


def _raw_game_dict(game: dict[str, object]) -> dict[str, object]:
    try:
        parsed = json.loads(str(game.get("raw_json") or "{}"))
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def player_labels_for_game(game: dict[str, object]) -> dict[str, object]:
    raw = _raw_game_dict(game)
    username = str(game.get("username") or "").strip()
    partner = str(game.get("partner") or "").strip()
    opponent = str(game.get("opponent") or "").strip()
    main_white = (
        str(game.get("white_username") or "").strip()
        or _raw_player_name(raw.get("white"))
        or str(raw.get("bughousePlayer1Name") or "").strip()
    )
    main_black = (
        str(game.get("black_username") or "").strip()
        or _raw_player_name(raw.get("black"))
        or str(raw.get("bughousePlayer2Name") or "").strip()
    )
    partner_white = str(raw.get("bughousePartnerPlayer1Name") or "").strip()
    partner_black = str(raw.get("bughousePartnerPlayer2Name") or "").strip()
    names = {
        "main_white": main_white or "Unknown",
        "main_black": main_black or "Unknown",
        "partner_white": partner_white or "Unknown",
        "partner_black": partner_black or "Unknown",
    }
    opponent_partner = _opponent_partner_name(names, username, partner, opponent)
    return {
        **names,
        "user": username or "Unknown",
        "partner": partner or "Unknown",
        "opponent": opponent or "Unknown",
        "opponent_partner": opponent_partner or "Unknown",
        "main_white_role": _player_role(names["main_white"], username, partner, opponent, names),
        "main_black_role": _player_role(names["main_black"], username, partner, opponent, names),
        "partner_white_role": _player_role(names["partner_white"], username, partner, opponent, names),
        "partner_black_role": _player_role(names["partner_black"], username, partner, opponent, names),
    }


def _raw_player_name(value: object) -> str:
    if isinstance(value, dict):
        return str(value.get("username") or "").strip()
    return ""


def _player_role(
    name: str,
    username: str,
    partner: str,
    opponent: str,
    names: dict[str, str],
) -> str:
    lowered = name.lower()
    if not lowered or lowered == "unknown":
        return ""
    if username and lowered == username.lower():
        return "You"
    if partner and lowered == partner.lower():
        return "Partner"
    if opponent and lowered == opponent.lower():
        return "Opponent"
    known = {username.lower(), partner.lower(), opponent.lower()} - {""}
    all_names = {value.lower() for value in names.values() if value and value != "Unknown"}
    if lowered in all_names and lowered not in known:
        return "Opponent partner"
    return ""


def _opponent_partner_name(
    names: dict[str, str],
    username: str,
    partner: str,
    opponent: str,
) -> str:
    known = {username.lower(), partner.lower(), opponent.lower(), "unknown", ""}
    for value in names.values():
        if value.lower() not in known:
            return value
    return ""


def _optional_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _report_from_payload(payload: dict[str, object]) -> BughouseDiscoveryReport:
    from src.full_bughouse_discovery import DiscoverySourceResult

    sources = [
        DiscoverySourceResult(
            name=str(item.get("name", "")),
            url=str(item.get("url", "")),
            status=str(item.get("status", "")),
            detail=str(item.get("detail", "")),
            evidence=dict(item.get("evidence", {})),
        )
        for item in payload.get("sources", [])
        if isinstance(item, dict)
    ]
    return BughouseDiscoveryReport(
        game_id=int(payload.get("game_id") or 0),
        game_url=str(payload.get("game_url") or ""),
        known_players=[str(item) for item in payload.get("known_players", [])],
        candidates=[dict(item) for item in payload.get("candidates", []) if isinstance(item, dict)],
        sources=sources,
        conclusion=str(payload.get("conclusion") or ""),
        partner_found=payload.get("partner_found") if isinstance(payload.get("partner_found"), str) else None,
        second_board_url=payload.get("second_board_url") if isinstance(payload.get("second_board_url"), str) else None,
    )


if __name__ == "__main__":
    main()
