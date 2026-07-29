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

Important current limitation: the existing imported-game library still uses `data/bughouse.db` so the current 395 MB local archive is immediately reusable. A public deployment must attach persistent storage for `data/`, or complete the planned migration of imported games into PostgreSQL. Chess.com PubAPI can omit the partner board; the UI reports `Second board unavailable` instead of fabricating it.

The `/health` endpoint verifies the application database and reports whether the Fairy-Stockfish executable is available. It never exposes credentials.

### Coupled Team Coach

The public app does not contain a shared hosted-AI API key. Its coaching pipeline is deliberately layered:

1. Fairy-Stockfish validates each available board and produces tactical lines.
2. `backend/coupled_analysis.py` verifies legal moves, cross-board transfers, resulting pockets, mates, clocks and partner danger.
3. Qwen3.5-4B Q4_K_M receives only that validated evidence.
4. Qwen ranks and explains the evidence using the fixed sections `Summary`, `Board A`, `Board B`, `Team plan`, `Piece request`, and `Urgency`.

The GGUF model is not committed to Git and is not embedded in the Docker image. On first use, Railway downloads `Qwen3.5-4B-Q4_K_M.gguf` to the attached persistent volume. `llama-cli` runs once per review and exits after the response so its RAM is released. If the model, binary, storage or memory is unavailable, the app returns the validated Fairy/coupled evidence without inventing a LLM answer.

The runtime keeps the requested `8192` context, `1200` maximum output tokens, `0.15` temperature and `0.85` top-p. It runs one templated conversation turn with reasoning disabled and a reasoning budget of `0`: Fairy-Stockfish and the coupled validator perform the tactical work, while Qwen writes a concise explanation directly.

Recommended Railway settings are a Hobby volume of at least 5 GB mounted at `/app/data`, enough RAM for the 2.71 GB quantized model plus context, and a spending limit. CPU inference can take significantly longer than Fairy-Stockfish analysis.

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

### Complete two-board Chess.com import

The public Chess.com API does not consistently expose the authenticated `pgn-info` payload containing the partner board. A normal web page also cannot read another site's Chess.com cookies because of browser origin isolation.

The connection modal therefore provides a safe one-time connector:

1. Open the Chess.com archive and sign in.
2. In browser Network tools, copy one `pgn-info` request as cURL (bash).
3. Paste it into `Load complete two-board data`.
4. The backend enriches all missing games in batches and discards the request credentials immediately.

No Chess.com password is requested or stored. A fully one-click public flow requires a separately installed/published browser extension or an official Chess.com OAuth/data API that exposes the partner-board payload.

Local Streamlit app for importing Chess.com Bughouse games, enriching partner-board data when available, and building a practical coaching dashboard with stats, training drills, opening review, and Fairy-Stockfish analysis.

The app is designed to run locally first. A GitHub copy should contain code and setup files only, not private Chess.com cookies, imported games, engine binaries, logs, or personal reports.

## GitHub Sharing Notes

This repository is safe to share only if these files stay out of Git:

- `secrets/chesscom_pgn_info_curl.txt`
- `data/bughouse.db`
- `logs/*.log`
- `engines/fairy-stockfish.exe`
- `.venv/`
- videos, ZIP exports, and generated reports

Each user should create their own local `secrets/chesscom_pgn_info_curl.txt` if they want authenticated two-board enrichment. The template file is:

```text
secrets/chesscom_pgn_info_curl.example.txt
```

Basic public game import can work without the cURL file, but many Bughouse games will not have partner-board replay data.

## Product Features

- Guided username-first setup and public Chess.com archive import.
- Optional authenticated enrichment with both boards, four player names, pockets, and clocks.
- Chronological two-board replay with captured pieces transferred to the partner board.
- Fairy-Stockfish mistake analysis, legal best-move overlays, mate-aware scoring, and versioned caching.
- Coaching priorities, context filters, session reports, smart training queue, and spaced repetition.
- Pattern Academy with validated Bughouse and classical tactical exercises.
- Opening Explorer grouped by the complete two-board position, including pockets, with opponent, partner, and rating filters.
- Local SQLite storage, duplicate protection, WAL concurrency, and no required cloud account.

## Analysis Integrity

The current analysis generation is `timeline-v2`. It reconstructs both boards on a shared clock timeline and transfers every captured piece to the capturer's partner. Captured promoted pieces return as pawns.

Older analysis rows remain stored in SQLite but are excluded from current dashboards and training. Run new Coach Analysis and Opening Explorer batches to rebuild trusted results. When exact cross-board clocks or partner data are absent, the replay is explicitly marked lower confidence instead of presenting an inferred state as certain.

Public Chess.com sources do not consistently include the second board. The authenticated `pgn-info` request is currently the most complete source observed for `bughousePartnerTcnMoves` and both clock streams.

## Chess.com pgn-info Setup

This is optional, but needed for automatic two-board import.

1. In a browser where you are logged in to Chess.com, open `https://www.chess.com/games/archive`.
2. Open DevTools, then the Network tab.
3. Trigger a PGN/archive request and find `https://www.chess.com/callback/game/pgn-info`.
4. Copy the request as cURL.
5. Save it locally as:

```text
secrets/chesscom_pgn_info_curl.txt
```

6. Start the app, confirm that path in the sidebar, then import games.

The app reads that file only to call Chess.com during import. It stores the returned game data in SQLite, not the cookies or tokens. `secrets/` is ignored by Git.

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
  chesscom_pgn_info.py
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
