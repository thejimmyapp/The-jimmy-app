# The Jimmy App — Collaborative Bughouse Coach (formerly Bughouse Coach AI)

## New Collaborative Web MVP

**The Jimmy App** is a collaborative Bughouse coach. The repository contains a parallel FastAPI + React/TypeScript application, while the original Streamlit coach remains available during the web migration.

### Web architecture

- `backend/`: FastAPI API, SQLAlchemy collaboration storage, Chess.com HTTPX client, background Fairy-Stockfish jobs, and versioned room WebSockets.
- `frontend/`: strict React/TypeScript single-page workspace with two synchronized boards, side pockets, global A+B timeline, review/exploration states, annotations, chat, and notes.
- `thejimmyapp/`: existing tested Bughouse parser, coupled transfer reconstruction, engine adapter, and coaching logic reused by FastAPI.
- `backend/alembic/`: production database migrations.

### Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd frontend
pnpm install
pnpm run build
cd ..
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Then open `http://127.0.0.1:8000`. After the first build, Windows users can also run `start_web_app.bat`.

For frontend development, run FastAPI on port `8000` and `pnpm dev` in `frontend/`; Vite proxies API and WebSocket traffic.

### Tests

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\ruff.exe check backend src tests app.py
cd frontend
pnpm run test
pnpm run lint
pnpm run build
```

### Docker and Railway

`Dockerfile` builds the React bundle, installs the official Fairy-Stockfish Linux x86-64 release binary, installs the Python service, runs Alembic, and serves the complete app through FastAPI.

```powershell
docker compose up --build
```

For Railway, create a project from this repository, add PostgreSQL and Redis services, copy the variables from `.env.example`, set `DATABASE_URL` to the Railway PostgreSQL URL, and deploy. Railway uses `railway.json` and checks `/health`.

Important current limitation: the imported-game library still uses `data/bughouse.db`. A public deployment must attach persistent storage for `data/`, or complete the planned migration of imported games into PostgreSQL. Chess.com PubAPI can omit the partner board; the UI reports `Second board unavailable` instead of fabricating it.

Verified deletion requests are handled with the dry-run-first operator procedure
in [`docs/operations/data-deletion-runbook.md`](docs/operations/data-deletion-runbook.md).

The `/health` endpoint verifies the application database and reports whether the Fairy-Stockfish executable is available. It never exposes credentials.

### Coupled Team Coach

The public app does not contain a shared hosted-AI API key. Its coaching pipeline is deliberately layered:

1. Fairy-Stockfish validates each available board and produces tactical lines.
2. `backend/coupled_analysis.py` verifies legal moves, cross-board transfers, resulting pockets, mates, clocks and partner danger.
3. Qwen3.5-4B Q4_K_M receives only that validated evidence and returns structured commentary keyed to machine-generated fact IDs.
4. The server rejects malformed, uncited, or fact-restating commentary and always renders side to move, engine move/evaluation, clocks, transfers, missing data, and urgency deterministically.

The GGUF model is not committed to Git and is not embedded in the Docker image. On first use, Railway downloads `Qwen3.5-4B-Q4_K_M.gguf` to the attached persistent volume. `llama-cli` runs once per review and exits after the response so its RAM is released. If the model, binary, storage or memory is unavailable, the app returns the validated Fairy/coupled evidence without inventing a LLM answer.

The default runtime uses a compact fact-only prompt, a `2048` context, `256` maximum output tokens, four generation/batch threads, `0.15` temperature and `0.85` top-p. It runs one schema-constrained conversation turn with reasoning and one-shot warmup disabled, capped at 90 seconds: Fairy-Stockfish and the coupled validator perform the tactical work, while Qwen writes optional concise commentary. Both boards are analyzed concurrently. Public Coach and leak-map work is process-locally bounded by active-job and retained-record caps; completed job records expire after 15 minutes by default.

Recommended Railway settings are a Hobby volume of at least 5 GB mounted at `/app/data`, enough RAM for the 2.71 GB quantized model plus context, and a spending limit. CPU inference can take significantly longer than Fairy-Stockfish analysis.

### Verification

Pull requests and `main` run backend tests/correctness checks, frontend tests,
lint, the Vite build, and the production Docker build through
`.github/workflows/ci.yml`. The **Production smoke** workflow can run the same
read-only post-deploy checks from GitHub's Actions tab.

After a deployment, run the read-only production smoke check:

```bash
python scripts/production_smoke.py --game-id 160643
```

Override `--base-url` to inspect another environment. The command never imports,
deletes, or analyzes a game; the optional game ID only verifies an existing
stored replay and its initial snapshot.

### Player Statistics

The web `Statistics` view summarizes the complete imported history with win rate, color split, twelve-month form, rating-band performance, partner chemistry, opponent history, two-board coverage and recurring coaching leaks. The API source is `GET /api/stats/{username}`.

### Exploration and legal annotations

- Drag a piece belonging to the player to move to explore a legal alternative.
- Drag a pocket piece to a legal drop square.
- Captures in exploration transfer the captured piece to the partner board.
- The orange `EXPLORATION` badge shows the official move where the branch began and its move sequence.
- Undo walks back through the branch; `Return to move` discards the branch and restores the untouched official position.
- Right-drag arrows are accepted only when they represent a legal move in the current position.
- Click an arrow to remove it.

### Complete two-board import

The public Chess.com API does not consistently expose the partner board.

The web app supports two complete-game recovery paths:

1. Open **Connect games**.
2. Choose **Import two-board PGNs** to paste Board A and Board B from the same game.
3. Or choose **Advanced pgn-info enrichment** and paste your own one-time Chess.com `pgn-info` cURL request to enrich already imported games.
4. The app reconstructs synchronized replays and uses PGN clock comments or Chess.com move timestamps when present.

The application never asks for a Chess.com password and does not store copied cURL requests, cookies, CSRF tokens, or reusable session credentials. A fully one-click public flow still requires an official Chess.com API that exposes complete partner-board data.

Local Streamlit app for importing completed Chess.com Bughouse games and building a practical coaching dashboard with stats, training drills, opening review, and Fairy-Stockfish analysis.

The app is designed to run locally first. A GitHub copy should contain code and setup files only, not private Chess.com cookies, imported games, engine binaries, logs, or personal reports.

## GitHub Sharing Notes

This repository is safe to share only if these files stay out of Git:

- `data/bughouse.db`
- `logs/*.log`
- `engines/fairy-stockfish.exe`
- `.venv/`
- videos, ZIP exports, and generated reports

Basic public game import works without credentials, but many Bughouse games will not have partner-board replay data. Use paired completed PGNs when both boards are available, or the advanced one-time `pgn-info` enrichment when you can safely copy the request from your own logged-in browser.

## Product Features

- Guided username-first setup and public Chess.com archive import.
- Credential-free paired PGN import with both boards, four player names, pockets, and clocks when present.
- Chronological two-board replay with captured pieces transferred to the partner board.
- Fairy-Stockfish mistake analysis, legal best-move overlays, mate-aware scoring, and versioned caching.
- Coaching priorities, context filters, session reports, smart training queue, and spaced repetition.
- Pattern Academy with validated Bughouse and classical tactical exercises.
- Opening Explorer grouped by the complete two-board position, including pockets, with opponent, partner, and rating filters.
- Local SQLite storage, duplicate protection, WAL concurrency, and no required cloud account.

## Analysis Integrity

The current analysis generation is `timeline-v2`. It reconstructs both boards on a shared clock timeline and transfers every captured piece to the capturer's partner. Captured promoted pieces return as pawns.

Older analysis rows remain stored in SQLite but are excluded from current dashboards and training. Run new Coach Analysis and Opening Explorer batches to rebuild trusted results. When exact cross-board clocks or partner data are absent, the replay is explicitly marked lower confidence instead of presenting an inferred state as certain.

When a completed game already has a current-version, high- or medium-confidence
mistake with a legal engine best move, the web review shows one **moment to
revisit**. The card links to the synchronized timeline position and displays
only stored engine evidence: played move, suggested move, estimated swing,
pattern, depth/confidence, and partner-board danger when that context was
actually analyzed. Games without qualifying evidence do not receive a generated
lesson.

Public Chess.com sources do not consistently include the second board or both clock streams. The supported complete-game path is paired PGN import while an official complete Bughouse data route is pursued.

## Windows Setup

### Portable Quick Start

For the easiest local setup, double-click:

```text
start_thejimmyapp.bat
```

The launcher creates `.venv`, installs dependencies, creates runtime folders, starts Streamlit, and opens `http://localhost:8501`.

For sharing a clean ZIP without local secrets or data, see:

```text
PORTABLE_APP.md
```

### Manual Setup

1. Install Python 3.11 or newer from [python.org](https://www.python.org/downloads/windows/).
2. Open PowerShell in this folder.
3. Create a virtual environment:

```powershell
python -m venv .venv
```

4. Activate it:

```powershell
.\.venv\Scripts\Activate.ps1
```

5. Install dependencies:

```powershell
pip install -r requirements.txt
```

6. Start the app:

```powershell
streamlit run app.py
```

7. Open the local URL shown by Streamlit, usually `http://localhost:8501`.

## Fairy-Stockfish Setup

Engine coaching expects a local Fairy-Stockfish executable.

1. Download a Windows Fairy-Stockfish release from:
   `https://github.com/fairy-stockfish/Fairy-Stockfish`
2. Put the executable here:

```text
engines/fairy-stockfish.exe
```

3. Start the app and open a game.
4. In the sidebar, confirm the Fairy-Stockfish path.
5. Open the `Engine analysis` tab.
6. Click `Analyze critical positions`.

If the binary does not expose `UCI_Variant`, the app still fails gracefully and marks the analysis lower confidence.

## Data Notes

Chess.com PubAPI is public and read-only. The app currently uses:

- `https://api.chess.com/pub/player/{username}/games/archives`
- monthly archive URLs returned by that endpoint

Bughouse detection is conservative:

- `rules == "bughouse"`
- `variant == "bughouse"`
- PGN header containing `Variant "Bughouse"` or `Rules "Bughouse"`

If Chess.com omits partner-board or pocket data, the app stores what is available and labels dependent analysis as incomplete or lower confidence.

## Project Layout

```text
app.py
thejimmyapp/
  analyzer.py
  board_renderer.py
  bughouse_reconstructor.py
  chesscom_api.py
  db.py
  engine.py
  pgn_parser.py
  versioning.py
tests/
data/
  bughouse.db
logs/
  app.log
reports/
engines/
  fairy-stockfish.exe
```

`data/`, `logs/`, `reports/`, and `engines/` are runtime folders and can be created locally as needed.
