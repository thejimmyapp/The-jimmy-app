"""Loopback-only real app, with fixture-backed upstream match discovery."""
from __future__ import annotations

import argparse
from copy import deepcopy
import importlib
import ipaddress
import json
import os
from pathlib import Path
import socket
import sys
import time


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report-dir", type=Path, required=True)
    parser.add_argument("--database-dir", type=Path, required=True)
    args = parser.parse_args()
    report = args.report_dir.resolve()
    report.mkdir(parents=True, exist_ok=True)
    if sys.version_info[:2] != (3, 11):
        raise RuntimeError("Use a Python 3.11 venv with requirements.txt installed")

    denied: list[dict[str, str]] = []
    guard_log = report / "backend-network.json"
    guard_log.write_text("[]\n")

    def guard(event: str, values: tuple) -> None:
        host = None
        if event == "socket.getaddrinfo":
            host = values[0]
        elif event in {"socket.connect", "socket.sendto"}:
            address = values[-1]
            if isinstance(address, tuple):
                host = address[0]
        if host is None:
            return
        if isinstance(host, bytes):
            host = host.decode("ascii")
        try:
            allowed = host == "localhost" or ipaddress.ip_address(host).is_loopback
        except ValueError:
            allowed = False
        if not allowed:
            denied.append({"event": event, "host": str(host)})
            guard_log.write_text(json.dumps(denied, indent=2) + "\n")
            raise RuntimeError(f"USAB blocked non-loopback network: {event} {host}")

    sys.addaudithook(guard)
    sys.path.insert(0, str(ROOT))
    database_dir = args.database_dir.resolve()
    if not database_dir.is_dir() or any(database_dir.iterdir()):
        raise RuntimeError("Database directory must be an empty directory owned by the launcher")
    os.environ.update({
        "DATABASE_URL": f"sqlite:///{database_dir / 'webapp.sqlite'}",
        "LEGACY_DATABASE_PATH": str(database_dir / "legacy.sqlite"),
        "QWEN_ENABLED": "false",
        "CHESSCOM_GUEST_WARM_ON_STARTUP": "false",
        "COOKIE_SECURE": "false",
        "TRUSTED_HOSTS": "127.0.0.1,localhost",
        "ENVIRONMENT": "test",
    })
    app_module = importlib.import_module("backend.main")
    uvicorn = importlib.import_module("uvicorn")
    fixtures = json.loads((ROOT / "frontend/src/fixtures/guest-match-replays.json").read_text())
    classes = [
        {"label": "2300+", "min": 2300, "max": None},
        {"label": "1900–2300", "min": 1900, "max": 2300},
        {"label": "1400–1900", "min": 1400, "max": 1900},
    ]
    sources = []
    for fixture_index, rating_class in zip([4, 0, 2], classes, strict=True):
        boards = deepcopy(fixtures["matches"][fixture_index]["boards"])
        seats = {}
        for board_id, board in boards.items():
            for color in ("white", "black"):
                key = color.title()
                rating = int(board["headers"][key + "Elo"])
                # The low-class row is synthetic metadata; move streams stay verbatim.
                if rating_class["min"] == 1400:
                    rating -= 300
                seats[f"{board_id}-{color}"] = {"name": board["headers"][key], "rating": rating}
        highest_seat = max(seats, key=lambda seat: seats[seat]["rating"])
        highest = seats[highest_seat]
        match = {
            "game_ids": {key: board["id"] for key, board in boards.items()},
            "end_time": int(time.time()) - 60,
            "seats": seats,
            "ply_counts": {key: board["plyCount"] for key, board in boards.items()},
            "decisive_board": "A", "loser_seat": "A-white", "action": "checkmated",
            "highest_rated": {**highest, "seat": highest_seat, "outcome": "WON" if highest_seat in {"A-black", "B-white"} else "LOST"},
            "loser_relative_to_highest": None,
            "rating_class": rating_class, "top_rating": highest["rating"],
            "finished_seconds_ago": 60,
        }
        sources.append({"match": match, "boards": boards})

    class FakeMatchups:
        async def guest_matchups(self, **_kwargs):
            return {
                "matches": [deepcopy(source["match"]) for source in sources],
                "classes": [{**item, "status": "fresh", "window_hours": 1} for item in classes],
                "examined": 3, "excluded": 0, "exclusion_counts": {},
                "players_sampled": [], "players_represented": [],
                "seed_source": "players_of_interest", "selection_window_hours": 1,
                "partial": False, "cached": True,
            }

        async def replay_source(self, game_id: int):
            for source in sources:
                if game_id in source["match"]["game_ids"].values():
                    return deepcopy(source)
            raise AssertionError(f"Unexpected fixture game ID: {game_id}")

    # This is the only replaced product service. Persistence and validation are real.
    app_module.chesscom_matchups = FakeMatchups()
    metadata = {
        "python": sys.version, "databaseDirectory": str(database_dir),
        "fixtureIndices": [4, 0, 2], "replacement": "backend.main.chesscom_matchups only",
        "qwenEnabled": app_module.settings.qwen_enabled,
        "warmOnStartup": app_module.settings.chesscom_guest_warm_on_startup,
        "cookieSecure": app_module.settings.cookie_secure,
    }
    (report / "backend.json").write_text(json.dumps(metadata, indent=2) + "\n")
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]

        class LocalServer(uvicorn.Server):
            async def startup(self, sockets=None):
                await super().startup(sockets=sockets)
                if self.started:
                    print(json.dumps({"usabBackendReady": f"http://127.0.0.1:{port}"}), flush=True)

        config = uvicorn.Config(app_module.app, host="127.0.0.1", port=port, log_level="warning", loop="asyncio")
        LocalServer(config).run(sockets=[listener])
    if denied:
        raise RuntimeError("Non-loopback network was attempted; see backend-network.json")


if __name__ == "__main__":
    main()
