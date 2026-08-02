from __future__ import annotations

import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, text

from thejimmyapp.data_deletion import DeletionRequest, process_deletion
from thejimmyapp.db import Database


def _seed_legacy_database(path: Path) -> None:
    database = Database(path)
    database.initialize()
    with database.connect() as conn:
        for username, url in (
            ("target", "https://chess.com/game/1"),
            ("other", "https://chess.com/game/2"),
        ):
            conn.execute(
                """
                INSERT INTO games (
                    username, url, result, raw_json, imported_at
                ) VALUES (?, ?, 'win', '{}', '2026-07-27T00:00:00Z')
                """,
                (username, url),
            )
        target_game_id = int(
            conn.execute("SELECT id FROM games WHERE username = 'target'").fetchone()["id"]
        )
        target_mistake = conn.execute(
            """
            INSERT INTO mistakes (
                game_id, username, ply, move, side, reason, category,
                severity, estimated_loss_cp, score_before, score_after,
                confidence, note, analysis_version, created_at
            ) VALUES (?, 'target', 1, 'e4', 'white', 'test', 'test',
                'mistake', 100, '0', '-100', 'high', 'test', 'timeline-v2',
                '2026-07-27T00:00:00Z')
            """,
            (target_game_id,),
        ).lastrowid
        conn.execute(
            """
            INSERT INTO drill_attempts (
                mistake_id, username, category, attempted_move, score, created_at
            ) VALUES (?, 'target', 'test', 'e4', 'correct', '2026-07-27T00:00:00Z')
            """,
            (target_mistake,),
        )
        conn.execute(
            """
            INSERT INTO import_runs (
                username, archive_count, imported_count, duplicate_count,
                skipped_count, error_count, errors_json, created_at
            ) VALUES ('target', 1, 1, 0, 0, 0, '[]', '2026-07-27T00:00:00Z')
            """
        )
        conn.execute(
            """
            INSERT INTO pattern_attempts (
                username, puzzle_id, category, motif, attempted_move,
                expected_move, score, created_at
            ) VALUES ('target', 'p1', 'test', 'test', 'e4', 'e4', 'correct',
                '2026-07-27T00:00:00Z')
            """
        )
        conn.execute(
            """
            INSERT INTO pattern_progress (
                username, puzzle_id, category, motif, next_due
            ) VALUES ('target', 'p1', 'test', 'test', '2026-07-27T00:00:00Z')
            """
        )
        conn.execute(
            """
            INSERT INTO engine_cache (cache_key, payload_json, created_at)
            VALUES ('cache', '{}', '2026-07-27T00:00:00Z')
            """
        )
        conn.commit()


def _seed_collaboration_database(url: str, target_game_id: int) -> None:
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE review_rooms (
                    id TEXT PRIMARY KEY,
                    game_id INTEGER,
                    created_at TEXT,
                    updated_at TEXT
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE shared_notes (
                    id TEXT PRIMARY KEY,
                    room_id TEXT NOT NULL,
                    content TEXT
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE chat_messages (
                    id TEXT PRIMARY KEY,
                    room_id TEXT NOT NULL,
                    content TEXT
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO review_rooms (id, game_id) VALUES
                ('target-room', :target_game_id),
                ('other-room', 999)
                """
            ),
            {"target_game_id": target_game_id},
        )
        conn.execute(
            text(
                """
                INSERT INTO shared_notes (id, room_id, content) VALUES
                ('target-note', 'target-room', 'delete'),
                ('other-note', 'other-room', 'keep')
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO chat_messages (id, room_id, content) VALUES
                ('target-chat', 'target-room', 'delete'),
                ('other-chat', 'other-room', 'keep')
                """
            )
        )
    engine.dispose()


def test_dry_run_reports_without_deleting(tmp_path: Path) -> None:
    legacy_path = tmp_path / "legacy.db"
    collaboration_url = f"sqlite:///{tmp_path / 'collaboration.db'}"
    _seed_legacy_database(legacy_path)
    with sqlite3.connect(legacy_path) as conn:
        target_game_id = int(
            conn.execute("SELECT id FROM games WHERE username = 'target'").fetchone()[0]
        )
    _seed_collaboration_database(collaboration_url, target_game_id)

    report = process_deletion(
        legacy_database_path=legacy_path,
        database_url=collaboration_url,
        request=DeletionRequest(username="Target"),
    )

    assert report["mode"] == "dry-run"
    assert report["legacy_database"]["counts"]["games"] == 1
    assert report["legacy_database"]["counts"]["drill_attempts"] == 1
    assert report["legacy_database"]["engine_cache_would_be_cleared"] is True
    assert report["collaboration_database"]["counts"] == {
        "shared_notes": 1,
        "chat_messages": 1,
        "review_rooms": 1,
    }
    with sqlite3.connect(legacy_path) as conn:
        assert conn.execute("SELECT COUNT(*) FROM games").fetchone()[0] == 2


def test_execute_deletes_only_the_verified_scope(tmp_path: Path) -> None:
    legacy_path = tmp_path / "legacy.db"
    collaboration_path = tmp_path / "collaboration.db"
    collaboration_url = f"sqlite:///{collaboration_path}"
    _seed_legacy_database(legacy_path)
    with sqlite3.connect(legacy_path) as conn:
        target_game_id = int(
            conn.execute("SELECT id FROM games WHERE username = 'target'").fetchone()[0]
        )
    _seed_collaboration_database(collaboration_url, target_game_id)

    report = process_deletion(
        legacy_database_path=legacy_path,
        database_url=collaboration_url,
        request=DeletionRequest(username="target"),
        execute=True,
    )

    assert report["mode"] == "execute"
    with sqlite3.connect(legacy_path) as conn:
        assert conn.execute("SELECT username FROM games").fetchall() == [("other",)]
        assert conn.execute("SELECT COUNT(*) FROM mistakes").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM drill_attempts").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM import_runs").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM pattern_attempts").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM pattern_progress").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM engine_cache").fetchone()[0] == 0
    with sqlite3.connect(collaboration_path) as conn:
        assert conn.execute("SELECT id FROM review_rooms").fetchall() == [("other-room",)]
        assert conn.execute("SELECT id FROM shared_notes").fetchall() == [("other-note",)]
        assert conn.execute("SELECT id FROM chat_messages").fetchall() == [("other-chat",)]
