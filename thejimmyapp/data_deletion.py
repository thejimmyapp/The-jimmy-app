from __future__ import annotations

import sqlite3
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, create_engine, inspect, text


@dataclass(frozen=True)
class DeletionRequest:
    username: str | None = None
    game_ids: tuple[int, ...] = ()
    room_ids: tuple[str, ...] = ()

    def normalized(self) -> "DeletionRequest":
        username = self.username.strip().lower() if self.username else None
        game_ids = tuple(sorted({int(game_id) for game_id in self.game_ids}))
        room_ids = tuple(sorted({room_id.strip() for room_id in self.room_ids if room_id.strip()}))
        if not username and not game_ids and not room_ids:
            raise ValueError("At least one username, game ID, or room ID is required.")
        return DeletionRequest(username=username, game_ids=game_ids, room_ids=room_ids)


def process_deletion(
    *,
    legacy_database_path: Path,
    database_url: str,
    request: DeletionRequest,
    execute: bool = False,
) -> dict[str, Any]:
    normalized = request.normalized()
    legacy = _process_legacy_database(legacy_database_path, normalized, execute=execute)
    collaboration = _process_collaboration_database(
        database_url,
        normalized,
        related_game_ids=tuple(legacy["matched_game_ids"]),
        execute=execute,
    )
    return {
        "mode": "execute" if execute else "dry-run",
        "selectors": {
            "username": normalized.username,
            "game_ids": list(normalized.game_ids),
            "room_ids": list(normalized.room_ids),
        },
        "legacy_database": legacy,
        "collaboration_database": collaboration,
    }


def _process_legacy_database(
    path: Path,
    request: DeletionRequest,
    *,
    execute: bool,
) -> dict[str, Any]:
    if not path.exists():
        return {"available": False, "matched_game_ids": [], "counts": {}}

    with closing(sqlite3.connect(path, timeout=30.0)) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        tables = _sqlite_tables(conn)
        game_ids = set(request.game_ids)
        if request.username and "games" in tables:
            rows = conn.execute(
                "SELECT id FROM games WHERE lower(username) = ?",
                (request.username,),
            ).fetchall()
            game_ids.update(int(row["id"]) for row in rows)
        matched_game_ids = tuple(sorted(game_ids))

        mistake_ids = _matching_ids(
            conn,
            table="mistakes",
            id_column="id",
            game_ids=matched_game_ids,
            username=request.username,
            tables=tables,
        )
        counts = {
            "drill_attempts": _count_matches(
                conn,
                "drill_attempts",
                where=_id_where("mistake_id", mistake_ids, request.username),
                params=_id_params(mistake_ids, request.username),
                tables=tables,
            ),
            "full_data_discovery": _count_matches(
                conn,
                "full_data_discovery",
                where=_ids_where("game_id", matched_game_ids),
                params=list(matched_game_ids),
                tables=tables,
            ),
            "mistakes": _count_matches(
                conn,
                "mistakes",
                where=_id_where("game_id", matched_game_ids, request.username),
                params=_id_params(matched_game_ids, request.username),
                tables=tables,
            ),
            "game_analysis_runs": _count_matches(
                conn,
                "game_analysis_runs",
                where=_id_where("game_id", matched_game_ids, request.username),
                params=_id_params(matched_game_ids, request.username),
                tables=tables,
            ),
            "opening_move_analysis": _count_matches(
                conn,
                "opening_move_analysis",
                where=_id_where("game_id", matched_game_ids, request.username),
                params=_id_params(matched_game_ids, request.username),
                tables=tables,
            ),
            "games": _count_matches(
                conn,
                "games",
                where=_ids_where("id", matched_game_ids),
                params=list(matched_game_ids),
                tables=tables,
            ),
            "import_runs": _count_username(conn, "import_runs", request.username, tables),
            "pattern_attempts": _count_username(conn, "pattern_attempts", request.username, tables),
            "pattern_progress": _count_username(conn, "pattern_progress", request.username, tables),
            "engine_cache_global": _count_matches(conn, "engine_cache", tables=tables),
        }

        matched_personal_rows = sum(
            count for name, count in counts.items() if name != "engine_cache_global"
        )
        clear_engine_cache = matched_personal_rows > 0 and counts["engine_cache_global"] > 0

        if execute:
            conn.execute("BEGIN IMMEDIATE")
            _delete_matches(
                conn,
                "drill_attempts",
                _id_where("mistake_id", mistake_ids, request.username),
                _id_params(mistake_ids, request.username),
                tables,
            )
            _delete_matches(
                conn,
                "full_data_discovery",
                _ids_where("game_id", matched_game_ids),
                list(matched_game_ids),
                tables,
            )
            for table in ("mistakes", "game_analysis_runs", "opening_move_analysis"):
                _delete_matches(
                    conn,
                    table,
                    _id_where("game_id", matched_game_ids, request.username),
                    _id_params(matched_game_ids, request.username),
                    tables,
                )
            _delete_matches(
                conn,
                "games",
                _ids_where("id", matched_game_ids),
                list(matched_game_ids),
                tables,
            )
            for table in ("import_runs", "pattern_attempts", "pattern_progress"):
                if request.username:
                    _delete_matches(
                        conn,
                        table,
                        "lower(username) = ?",
                        [request.username],
                        tables,
                    )
            if clear_engine_cache and "engine_cache" in tables:
                conn.execute("DELETE FROM engine_cache")
            conn.commit()

        return {
            "available": True,
            "matched_game_ids": list(matched_game_ids),
            "counts": counts,
            "engine_cache_would_be_cleared": clear_engine_cache,
        }


def _process_collaboration_database(
    database_url: str,
    request: DeletionRequest,
    *,
    related_game_ids: tuple[int, ...],
    execute: bool,
) -> dict[str, Any]:
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False} if database_url.startswith("sqlite") else {},
        pool_pre_ping=True,
    )
    try:
        return _process_collaboration_engine(
            engine,
            request,
            related_game_ids=related_game_ids,
            execute=execute,
        )
    finally:
        engine.dispose()


def _process_collaboration_engine(
    engine: Engine,
    request: DeletionRequest,
    *,
    related_game_ids: tuple[int, ...],
    execute: bool,
) -> dict[str, Any]:
    tables = set(inspect(engine).get_table_names())
    required = {"review_rooms", "shared_notes", "chat_messages"}
    if not required.issubset(tables):
        return {"available": False, "matched_room_ids": [], "counts": {}}

    with engine.connect() as conn:
        room_ids = set(request.room_ids)
        if related_game_ids:
            clause, params = _sqlalchemy_in_clause("game_id", related_game_ids, "game")
            rows = conn.execute(text(f"SELECT id FROM review_rooms WHERE {clause}"), params)
            room_ids.update(str(row.id) for row in rows)
        matched_room_ids = tuple(sorted(room_ids))

        if not matched_room_ids:
            return {
                "available": True,
                "matched_room_ids": [],
                "counts": {"shared_notes": 0, "chat_messages": 0, "review_rooms": 0},
            }

        clause, params = _sqlalchemy_in_clause("room_id", matched_room_ids, "room")
        room_clause, room_params = _sqlalchemy_in_clause("id", matched_room_ids, "room")
        counts = {
            "shared_notes": int(
                conn.execute(text(f"SELECT COUNT(*) FROM shared_notes WHERE {clause}"), params).scalar_one()
            ),
            "chat_messages": int(
                conn.execute(text(f"SELECT COUNT(*) FROM chat_messages WHERE {clause}"), params).scalar_one()
            ),
            "review_rooms": int(
                conn.execute(
                    text(f"SELECT COUNT(*) FROM review_rooms WHERE {room_clause}"),
                    room_params,
                ).scalar_one()
            ),
        }

    if execute:
        with engine.begin() as conn:
            clause, params = _sqlalchemy_in_clause("room_id", matched_room_ids, "room")
            room_clause, room_params = _sqlalchemy_in_clause("id", matched_room_ids, "room")
            conn.execute(text(f"DELETE FROM shared_notes WHERE {clause}"), params)
            conn.execute(text(f"DELETE FROM chat_messages WHERE {clause}"), params)
            conn.execute(text(f"DELETE FROM review_rooms WHERE {room_clause}"), room_params)

    return {
        "available": True,
        "matched_room_ids": list(matched_room_ids),
        "counts": counts,
    }


def _sqlite_tables(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    return {str(row["name"]) for row in rows}


def _matching_ids(
    conn: sqlite3.Connection,
    *,
    table: str,
    id_column: str,
    game_ids: tuple[int, ...],
    username: str | None,
    tables: set[str],
) -> tuple[int, ...]:
    if table not in tables:
        return ()
    where = _id_where("game_id", game_ids, username)
    if not where:
        return ()
    rows = conn.execute(
        f"SELECT {id_column} FROM {table} WHERE {where}",
        _id_params(game_ids, username),
    ).fetchall()
    return tuple(sorted(int(row[id_column]) for row in rows))


def _count_username(
    conn: sqlite3.Connection,
    table: str,
    username: str | None,
    tables: set[str],
) -> int:
    if not username:
        return 0
    return _count_matches(
        conn,
        table,
        where="lower(username) = ?",
        params=[username],
        tables=tables,
    )


def _count_matches(
    conn: sqlite3.Connection,
    table: str,
    where: str = "",
    params: list[Any] | None = None,
    *,
    tables: set[str],
) -> int:
    if table not in tables or (where == "" and params):
        return 0
    suffix = f" WHERE {where}" if where else ""
    row = conn.execute(f"SELECT COUNT(*) AS count FROM {table}{suffix}", params or []).fetchone()
    return int(row["count"])


def _delete_matches(
    conn: sqlite3.Connection,
    table: str,
    where: str,
    params: list[Any],
    tables: set[str],
) -> None:
    if table in tables and where:
        conn.execute(f"DELETE FROM {table} WHERE {where}", params)


def _ids_where(column: str, values: tuple[int, ...]) -> str:
    if not values:
        return ""
    placeholders = ", ".join("?" for _ in values)
    return f"{column} IN ({placeholders})"


def _id_where(column: str, values: tuple[int, ...], username: str | None) -> str:
    clauses: list[str] = []
    ids = _ids_where(column, values)
    if ids:
        clauses.append(ids)
    if username:
        clauses.append("lower(username) = ?")
    return " OR ".join(clauses)


def _id_params(values: tuple[int, ...], username: str | None) -> list[Any]:
    params: list[Any] = list(values)
    if username:
        params.append(username)
    return params


def _sqlalchemy_in_clause(
    column: str,
    values: tuple[int, ...] | tuple[str, ...],
    prefix: str,
) -> tuple[str, dict[str, Any]]:
    params = {f"{prefix}_{index}": value for index, value in enumerate(values)}
    placeholders = ", ".join(f":{name}" for name in params)
    return f"{column} IN ({placeholders})", params
