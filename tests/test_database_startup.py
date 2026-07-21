from __future__ import annotations

import sqlite3

import pytest

from thejimmyapp.db import Database


class FullDiskConnection:
    def executescript(self, _: str) -> None:
        raise sqlite3.OperationalError("database or disk is full")

    def close(self) -> None:
        pass


def test_initialize_allows_existing_database_when_disk_is_full(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    database_path = tmp_path / "bughouse.db"
    database_path.write_bytes(b"existing sqlite database")
    database = Database(database_path)
    monkeypatch.setattr(database, "connect", lambda: FullDiskConnection())

    database.initialize()


def test_initialize_raises_disk_full_when_database_is_missing(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    database = Database(tmp_path / "missing.db")
    monkeypatch.setattr(database, "connect", lambda: FullDiskConnection())

    with pytest.raises(sqlite3.OperationalError, match="disk is full"):
        database.initialize()
