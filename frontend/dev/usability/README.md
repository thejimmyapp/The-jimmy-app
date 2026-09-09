# Offline guest publishing regression

From a fresh checkout, install frontend dependencies with `pnpm install --frozen-lockfile`
in `frontend/`. Create a Python **3.11** virtual environment at the repository's
`.venv` and install `requirements-dev.txt`. Install Google Chrome, or set
`PLAYWRIGHT_EXECUTABLE_PATH` to an existing Chromium executable. Dependency and
browser installation are preparation steps and may require network access.

Then, from `frontend/`, run:

```sh
pnpm usability:journey
```

The command makes a fresh default build, serves it through the real FastAPI SPA
catch-all on an ephemeral `127.0.0.1` port, and runs four Playwright journeys:
default and `?ui=study`, each at 1440×900 and 1024×768 in dark mode. Each uses a
fresh browser context and publishes three moments before the unchanged five-minute
timer expires. The command exits nonzero on any failed assertion and stops at the
first failed journey.

Optional environment variables:

- `USAB_PYTHON`: Python 3.11 executable (otherwise `.venv/bin/python`, then `python3.11`).
- `USAB_REPORT_DIR`: evidence directory (otherwise `reports/usability-journey/<timestamp>`).
- `PLAYWRIGHT_EXECUTABLE_PATH`: browser executable (otherwise installed Google Chrome).

The parent launcher owns a temporary SQLite directory, stops the backend, and
removes the directory on success or failure, including a forced backend shutdown.
`cleanup.json` records removal. Qwen, matchup warmup, and secure cookies are disabled
for the local test. The public build URL is cleared for this build.

## Fixture boundary

Only `backend.main.chesscom_matchups` is replaced, using the `FakeMatchups` pattern
from `tests/test_guest_game_bridge.py`. Three classified rows use entries 4, 0, and
2 of `frontend/src/fixtures/guest-match-replays.json`. Replay headers, IDs, and move
streams remain unchanged. Low-class list ratings are synthetic metadata derived
by subtracting 300 from the fixture seat ratings. Guest creation, game storage,
replay processing, exploration validation, moment persistence, and completion
counts all run through the real services and routes against temporary databases.

Python socket audit hooks reject and record non-loopback connections and DNS
lookups. Browser routes reject requests outside the exact local origin, including
WebSockets; service workers are blocked. Any recorded violation fails the run.
The browser observes API responses but never sends requests directly or mocks
responses. This is an offline product-flow regression; live upstream discovery
and production deployment still require the gate's production check.

## Assertions and evidence

The driver clicks slides, Start, a matchup card, moment controls, move tokens,
glyph tiles, source and destination squares, the answer box, and Save. Replay
advancement uses the board wheel or Study's visible Next move button. Typing is
limited to the clicked answer box. DOM reads measure geometry and read rendered
legal targets; they do not change state. A source check rejects keyboard navigation,
native select manipulation, forced/synthetic clicks, direct APIs, storage writes,
and common state-injection shortcuts.

Each run checks Cancel at step 1 and reopens the wizard; a distinct move token for
each moment; the selected glyph tile; a board at least 400×400 with 64 squares at
least 45×45; Save within the viewport before clicking; three HTTP 201 saves; visible
3/3 and Quest complete; and the real guest response with count 3 and completed true.
It also fails on API errors, page errors, network violations, reset/claim calls,
or reused guest identities between contexts.

Evidence includes per-step screenshots, action and API logs, complete geometry,
per-moment timings, backend metadata and diagnostics, build output, network audit,
and cleanup. On failure, `failure.txt`, the current stage, and `FAILED.png` explain
where the journey stopped. The copy placeholder in the completion assertion is
the current product string and should change when the product copy changes.

## Sensitivity checks

For gate review, temporarily removing either original fix must make this command
fail: removing the wizard board-stage aspect ratio fails step-3 geometry; removing
the matchup card's `onClick` fails card selection. Restore the product files before
committing. These negative controls are evidence runs, not alternate product code
or a required part of every regression run.
