# GATE 4 — HANDOFF (night of 2026-09-04 → 05, autopilot)

Read with `docs/ROBOT-DOCKET.md`. Every claim below was verified against git or
against production by the gate, not taken from an executor report.

## 1. State of `main`

| Item | Value |
|---|---|
| `main` | `bc6f967` (LAND-04 merge, 2026-09-07 10:30 PT) |
| Golden build on that tree | Ruff ok · pytest **191** · vitest **211** (44 files) · ESLint ok · Vite build ok |
| Production | `https://www.thejimmyapp.com` — `/health` ok; bundle `index-D3le_Hua.css` + `index-DbWXpsdu.js`; `/openapi.json` 42 paths |
| Railway | project `thejimmyapp-ryan` (`65513c12-b3af-4d42-ac78-cdb3c34a9ae5`), env `production` (`2567c380-…`), service `thejimmyapp` (`ea408278-…`), region sfo, volume `thejimmyapp-volume` at `/app/data` |

The "lost" flashcard build was never lost: the worktree that was deleted was a
`git worktree` of the canonical repo, so its commit lived in the canonical `.git`
as an unpushed local branch. Lesson stays: **push the instant you commit.**

## 2. Production walk-through as a fresh guest (2026-09-05, guest #50)

| Step | Result |
|---|---|
| Landing → "Click me?" → matchup list | List took ~15 s cold (`partial: true`, `assembly_budget_exhausted`, 2 games not 5); cached on the next load |
| Enter on the list → game loads | OK (`/api/chesscom/matches/{id}/replay` 200) |
| Wizard ×3 (move → glyph → alternative on board → answer → save) | 3 × `POST /api/moments` OK |
| Session after the third save | `completed=true`, `completion_ordinal=1`, `completions_to_date=1` — first completion on this deployment |
| Library grade (`POST /api/moments/1/review good`) | `attempts=1`, `due=false`; badges update |
| Claim-identity form | Rendered, email input, not submitted (owner's call) |

**Defect LIBRARY-01 (P0 for the loop) — fixed, merged `adb2989`, verified on
production with a real click.** The library overlay rendered, but every
control in it (Flip / Next / Grade / Claim / Close) was unreachable by mouse:
`document.elementFromPoint` over the "Grade good" button returns a board square.
`.app-stage > #app-stage-panel { pointer-events: none }` (styles.css:1534) and
`.guest-library-backdrop` (styles.css:1919) never restores it — unlike
`.moment-editor-backdrop`, which has `pointer-events: auto`. Fix is one
declaration; branch `codex/library-pointer-events` (frontend suites green).
Re-verify after deploy: open the library, run
`document.elementFromPoint(...)` over a grade button → must be the button.

Matchup list cold-load time: fixed by Task 52 (`claude/task-52-guest-list-warm`,
merged `a843dd6`, pytest 191). Production after deploy: 5 games in ~114 ms,
`cached=true`, `pool_size=23`, background build 25 s at startup.

## 3. State / queue

`main` = `7b4b3e37e55c46fd23e29e675c4d981bfefd7311`; merged 2026-09-07/08 after `a3422f6`: LEDGER-4, LAND-03, LAND-05, LAND-04, LEDGER-5, UX-01, DOCS-01, LEGAL-01 memo, LEDGER-6, LIST-01, BOARD-01, LIST-02, LIST-03; golden at M3: vitest 46 files / 223 tests, pytest 204.

**HELD:** SHELL-01 `899e48b` (merges clean on current main).

**Open owner calls:** SHELL-01 ruling; LEGAL-01 copy approval (6 blocks + deletion scope: identity only or moments too); carousel UX-02 (STRUCTURE / VERBATIM / DROP; brand); credential memo (magic link · password · Chess.com OAuth); founder ordinals #1–#2; guest-list copy (explainer, empty-class row, rotation note — three [COPY-PLACEHOLDER]s); optional seed usernames for 1900–2300 / 1400–1900 via `CHESSCOM_SEED_PLAYERS_1900_2300` / `_1400_1900`; LOG-01; TEST-01.

**Gate notes for AUTOPILOT:** keep-awake = `launchctl submit -l com.thejimmyapp.keepawake -- /usr/bin/caffeinate -dimsu -t <secs>` (Codex reaps `nohup &` children); the screen-control grant drops when the Mac idle-locks (caffeinate does not stop the screen saver) — heartbeat input every ≤3 min or disable the lock for the window; Codex composer accepts clipboard paste + Return in display-scope mode only; lane reports are mirrored at `4robots/HARDCODE/gate4-work/reports/<TAG>.md`. Merge identity for non-fast-forward merges = `git merge-tree --write-tree main branch` tree hash, never an empty diff vs the branch.

## 4. Save-moment → account-unlock loop — what exists

| Piece | State |
|---|---|
| Guest identity cookie, `POST /api/guests`, `/api/guests/reset` | Live |
| Three-for-five completion (`guest_completions`, `completion_ordinal`) | Live, verified |
| `POST /api/accounts/claim` (email only, gated on completion) + account cookie | Live |
| `GET /api/accounts/me` | Live |
| Claim UI in the library panel (`completionRecorded`) | Live (LIBRARY-01 fixed, `adb2989`) |
| Return path on another device / after cookie loss | **Missing** — this is the held credential-intake decision (P0, owner) |
| What an account unlocks beyond the label | **Undefined** — product decision |

Nothing in this loop should be built until the owner rules on credential intake.

## 5. Unpushed work in the canonical repo (push-only, no merge)

| Local branch | SHA | vs `main` | On origin |
|---|---|---|---|
| `claude/task-52-guest-list-warm` | `c7bdb43` | merged `a843dd6` | yes (pushed 2026-09-05) |
| `codex/review-layout-results` | `b0f96a8` | unmerged, +1, stale (base `d6e8ced`) | yes (pushed 2026-09-05) |
| `codex/task-14-guest-bridge` | `1efcfcb` | merged | no |
| `codex/task-26-headline-split` | `cb35370` | merged | no |

`origin/codex/url-first-exact-replay` (`eca86ff`) is on origin and unmerged.

## 6. Operating notes for the next gate

- Reads through the mounted worktree: `GIT_OPTIONAL_LOCKS=0` (or
  `--no-optional-locks`). The mount cannot unlink; a stray `index.lock` was
  created once tonight and moved out to `HARDCODE/gate4-work/_to_delete/`.
- Work clones live in `HARDCODE/gate4-work/` (persistent, delete permission
  granted per-folder mount — use the `mnt/HARDCODE` path, not `mnt/Documents/...`).
- The device VM has git + node 22 + python 3.10 (no `datetime.UTC` → backend
  tests need the cloud's 3.11), no railway/gh, no git credentials. Pushes go
  through a Codex lane (macOS keychain).
- Codex desktop control: background app tools work for typing into the open
  lane's composer (whole-field replace + return); switching lanes by clicking
  the sidebar does not register. One executor lane per night is enough.
- Executor reports are mirrored to `HARDCODE/gate4-work/reports/<TAG>.md`;
  read them there instead of scrolling the Codex window.
- Verify a deploy by `/openapi.json` (route list), not by GET on a POST route
  (the SPA catch-all returns `api_404` for any unknown `/api/*` GET).
- Prod e2e: the Claude built-in browser pane works; emulate ≥ 992 px wide
  (`resize_window`), drive keyboard-only controls with dispatched
  `KeyboardEvent`s, set React inputs through `form_input`.
- Browser pane: with viewport emulation on, the click-coordinate factor depends on the pane size — 800×565 pane mapped 1:1 with the picture (CSS = frame × 992/800), a 393×277 pane mapped squared (CSS = frame × (992/393)²). Calibrate once per session with a document click listener before clicking anything that matters; the wizard's Save button sits below a 700 px fold — scrollIntoView first.
- Production bundle identity: build with VITE_PUBLIC_BASE_URL=https://www.thejimmyapp.com to reproduce the deployed JS filename (publicUrl.ts bakes it); the CSS filename matches the default build.
- Backend tests in the cloud container: Debian's setuptools breaks the chess==1.11.2 sdist build — use a venv (python3 -m venv), then python -m pytest -q from the repo root (191).
