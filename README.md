# The Jimmy App

Collaborative Bughouse Coach for importing Chess.com Bughouse games, enriching partner-board data when available, and building a practical coaching dashboard with stats, training drills, opening review, and Fairy-Stockfish analysis.

Brand map:

- Public brand: The Jimmy App
- Early descriptor: Collaborative Bughouse Coach
- Internal nickname: The App
- Primary domain: `thejimmyapp.com`
- Code slug: `thejimmyapp`

The Jimmy App is designed to run locally first. A GitHub copy should contain code and setup files only, not private Chess.com cookies, imported games, engine binaries, logs, or personal reports.

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

## Phase 1 Features

- Enter a Chess.com username.
- Fetch the user's public monthly archives through Chess.com PubAPI.
- Filter imported data to Bughouse games only.
- Store games locally in SQLite at `data/bughouse.db`.
- Avoid duplicate imports with a unique `(username, url)` key.
- Extract basic game metadata when available:
  - result
  - opponent
  - opponent rating
  - color
  - partner from PGN headers if Chess.com exposes it
  - time control and time class
- Show a dark Streamlit dashboard with:
  - total games
  - winrate
  - winrate by partner when partner metadata exists
  - game table with opponent/result filters
- Log import errors to `logs/app.log`.

## Phase 2 Features

- Parse stored PGN headers and main-line move text.
- Decode Chess.com `tcn` move lists when Bughouse games have no PGN payload.
- Extract move clocks from PGN comments when Chess.com includes `%clk`.
- Show a selectable game viewer inside the dashboard.
- Show a move list with:
  - ply
  - SAN move
  - clock
  - estimated time spent
  - drop/capture/check/mate flags
  - PGN comments
- Extract heuristic critical moments:
  - checks and mates
  - piece drops
  - major-piece captures
  - time trouble
  - long thinks and large clock drops
- Reconstruct the main board with `python-chess` when the PGN line is standard enough to apply.

When Chess.com only provides `tcn`, the app can list moves and drops, but clocks may be unavailable.

## Phase 3 Features

- Configurable Fairy-Stockfish path in the Streamlit sidebar.
- Default expected Windows path: `engines/fairy-stockfish.exe`.
- UCI subprocess integration with timeout protection.
- UCI handshake and best-move analysis.
- Tries `setoption name UCI_Variant value bughouse` when the engine exposes `UCI_Variant`.
- Graceful error message when the executable is missing or cannot be started.
- Engine analysis tab for selected games.
- Analyzes reconstructible critical positions from Phase 2.
- Caches analyzed FEN positions in SQLite to avoid repeating the same engine work.

Phase 3 still does **not** classify mistakes into final coaching categories. That starts in Phase 4. Engine output is shown as tactical evidence, with low confidence whenever Bughouse pockets or partner-board context are missing.

## Phase 3.5 Features

- Reconstruct Chess.com Bughouse `tcn` games beyond the first drop.
- Replay games in a visual board component instead of a text board.
- Jump directly to decoded critical moments from replay buttons.
- Show a second board panel; it is marked unavailable when Chess.com PubAPI does not provide partner-board state.
- Use `python-chess` Crazyhouse-style board support to apply drop moves.
- Infer pocket pieces when Chess.com does not expose partner-board capture sources.
- Show both:
  - board-only FEN
  - Bughouse/Crazyhouse FEN with pockets
- Show reconstruction confidence and pocket summaries in the board tab.
- Send pocket FENs to Fairy-Stockfish when available.
- Keep low confidence whenever pockets were inferred.

This is still a best-effort single-board reconstruction. True Bughouse certainty requires partner-board move/capture timing, which Chess.com PubAPI does not always expose in the imported payload.

## Phase 3.6 Features

- Optional authenticated Chess.com `pgn-info` enrichment during import.
- When a copied `pgn-info` cURL is available, imported Bughouse games can store:
  - main-board TCN
  - partner-board TCN
  - both board clocks
  - all four player names exposed by Chess.com
- The visual replay can show both boards when partner-board TCN is available.
- Automatically checks public sources for extra Bughouse context when a game is opened, then caches the report:
  - `https://www.chess.com/games/archive/...`
  - Chess.com game page HTML
  - monthly JSON archives for the two known board players
  - monthly PGN exports for the two known board players
- Reports whether a partner candidate or second board was found.
- Avoids broad guesses: only current-board or near-time archive records are treated as candidates.

Public sources alone are incomplete for Bughouse. The authenticated `pgn-info` endpoint is the source that exposed `bughousePartnerTcnMoves` in testing.

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

Phase 3 expects a local Fairy-Stockfish executable.

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

If Chess.com omits partner-board or pocket data in a game payload, Phase 1 stores what is available and leaves deeper diagnosis for later phases.

## Project Layout

```text
app.py
src/
  analyzer.py
  board_renderer.py
  bughouse_reconstructor.py
  chesscom_api.py
  chesscom_pgn_info.py
  db.py
  engine.py
  pgn_parser.py
data/
  bughouse.db
logs/
  app.log
reports/
engines/
  fairy-stockfish.exe
```

`data/`, `logs/`, `reports/`, and `engines/` are runtime folders and can be created locally as needed.
