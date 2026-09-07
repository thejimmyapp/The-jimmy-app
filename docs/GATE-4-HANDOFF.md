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

## 3. Custom domain — RESOLVED (www on Railway, apex via Cloudflare, 2026-09-07)

[https://www.thejimmyapp.com](https://www.thejimmyapp.com) is live on the Ryan-owned service (custom domain 93ccc8f8, certificate valid). Apex thejimmyapp.com resolved 2026-09-07 via Ryan's Cloudflare account (authoritative DNS moved from Namecheap; zone a79406defec75fbddf81be167d36ef68): proxied placeholder + redirect rule [https://thejimmyapp.com/*](https://thejimmyapp.com/*) -> [https://www.thejimmyapp.com/${1}](https://www.thejimmyapp.com/${1}) (301, query preserved), Always Use HTTPS, Universal certificate active; www stays DNS-only so Railway terminates TLS. Gate-verified: [https://thejimmyapp.com/?x](https://thejimmyapp.com/?x) -> [https://www.thejimmyapp.com/?x](https://www.thejimmyapp.com/?x); [http://thejimmyapp.com/health](http://thejimmyapp.com/health) -> www /health JSON. Mail records (MX, SPF, DKIM, DMARC, Google verifications) migrated intact. Jimmy's stale Railway binding no longer blocks anything.

Railway variables now list www in `TRUSTED_HOSTS`, `CORS_ORIGINS`,
`WEBSOCKET_ORIGINS`; `VITE_PUBLIC_BASE_URL` and
`CHESSCOM_OAUTH_CALLBACK_URL` point at www (the callback change was outside the
order; the Chess.com app registration must match before OAuth is enabled).

Canonical origin ruling: [www.thejimmyapp.com](http://www.thejimmyapp.com).

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
