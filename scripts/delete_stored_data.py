from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.config import get_settings  # noqa: E402
from thejimmyapp.data_deletion import DeletionRequest, process_deletion  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Preview or execute a verified Jimmy App data-deletion request."
    )
    parser.add_argument("--username", help="Verified Chess.com username.")
    parser.add_argument("--game-id", action="append", type=int, default=[])
    parser.add_argument("--room-id", action="append", default=[])
    parser.add_argument("--request-id", help="Internal request/ticket identifier.")
    parser.add_argument("--execute", action="store_true", help="Perform deletion; default is dry-run.")
    parser.add_argument("--legacy-db", type=Path)
    parser.add_argument("--database-url")
    args = parser.parse_args()

    if args.execute and not args.request_id:
        parser.error("--execute requires --request-id for an auditable operator record")

    settings = get_settings()
    result = process_deletion(
        legacy_database_path=args.legacy_db or settings.legacy_database_path,
        database_url=args.database_url or settings.database_url,
        request=DeletionRequest(
            username=args.username,
            game_ids=tuple(args.game_id),
            room_ids=tuple(args.room_id),
        ),
        execute=args.execute,
    )
    result["request_id"] = args.request_id
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
