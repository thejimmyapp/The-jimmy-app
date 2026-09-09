# GATE 4 — HANDOFF (night of 2026-09-04 → 05, autopilot)

Read with `docs/ROBOT-DOCKET.md`. Every claim below was verified against git or
against production by the gate, not taken from an executor report.

## 1. State of `main`

`main` = `ca3d4d67a54b59b628ea9d711fbbf984d711608e` (M20). Merge chain after M9 `a430267`: M10 `24a10ce` LEDGER-8 · M11 `e490001` PARITY-05b · M12 `f9b3e39` PARITY-05c · M13 `74a7d69` PARITY-05d · M14 `8a25ad4` PARITY-06a · M15 `ddb4417` PARITY-06b rulings · M16 `ac75e42` PARITY-06c · M17 `f9573de` PARITY-06d + PARITY-06b-ADD2 · M18 `fb391e3` USAB-01 · M19 `2bf4adb` USAB-02 · M20 `ca3d4d6` USAB-03. Golden at M20 (gate, merged tree): vitest 70 files / 323 tests, eslint clean, pytest 204 (backend unchanged since M3); production serves `index-Bfz8bXse.js` + `index-DbVLPTEY.css` (verified 2026-09-09 21:29Z).

**HELD:** none — SHELL-01 `899e48b` superseded by UX-06 (branch left unmerged).

**Open owner calls:** email verification (drop "click Verify email" from the challenge definition, or build send + `/api/accounts/verify` + result page — LAND-05/LAND-06) · study UI default flip (`?ui=study` → default; keep "Classic view") · look (Lichess anonymous brown/680 vs the owner's wood/800 zoom → large-display preset) · OBS-02 seeds (`CHESSCOM_SEED_PLAYERS_1400_1900`) vs LIST-04 · quest timeout failure summary copy (R58 resets silently today) · `[COPY-PLACEHOLDER]` copy still visible on production: onboarding slides, wizard step-4 prompt, completion banner "Quest complete", guest-list rows, claim modal · guest-cockpit removal candidates (FUTURE-* engine specimens, Team Coach, the glyph picker's "Pointer fallback" select now that the tiles are buttons, raw board IDs) · LEGAL-01 copy approval · carousel UX-02 · founder ordinals: completion ordinals #4–#7 were consumed by the gate's acceptance guests #591–#594 on 2026-09-09 (test data in production) · TEST-01 · LOG-01.

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
- File channel (DISPATCH-01, proven 2026-09-08): a lane waits with `timeout 540 bash -c 'until [ -s /Users/user/Documents/4robots/HARDCODE/gate4-work/orders/LANE-N.next ]; do sleep 15; done; echo ARRIVED'` (3–4 empty waits, counter reset by each order), moves the file to `orders/done/LANE-N.<UTC>.md`, executes it as a gate order, mirrors `reports/<TAG>.md`, resumes waiting. The gate writes orders via device_bash (write `.tmp`, then `mv`). Pickup ≤ 30 s; an order written while the lane is busy is picked up when it returns to waiting. No-op KEEPALIVE-n orders keep an idle lane alive.
- Expected production asset names in an order = the gate's own golden build of the candidate tree (they equal the deployed names); a lane's earlier build can print different JS hashes for the same tree.
- Lichess reference captures: the study returns its 404 page to a `HeadlessChrome` user agent — capture with the installed Chrome UA minus "Headless"; anonymous = Lichess defaults (brown flat board, 680 px at 1440×900), the owner's logged-in view carries his zoom/theme prefs.
- Merge identity for `--no-ff` merges is the `git merge-tree --write-tree main branch` tree hash, never a diff against the branch (main may have moved).
- When `main` has moved since a candidate's base, golden the local `--no-ff` test merge of the pinned SHA on the current `main` (its tree must equal `git merge-tree --write-tree origin/main <sha>`); that merged tree's www build names are the deployed names, and the merge order carries that tree hash as the identity check.
- The built-in browser pane's own pointer clicks do not reach React (confirmed 2026-09-09 on the landing carousel); the pane is for logic/geometry checks with dispatched events. Real-pointer production acceptance runs in a lane's isolated Playwright Chrome with ephemeral contexts (Lane 5's USAB-PROD-WALK drivers under gate4-work/reports/).

**Gate notes for AUTOPILOT:** keep-awake = `launchctl submit -l com.thejimmyapp.keepawake -- /usr/bin/caffeinate -dimsu -t <secs>` (Codex reaps `nohup &` children); the screen-control grant drops when the Mac idle-locks (caffeinate does not stop the screen saver) — heartbeat input every ≤3 min or disable the lock for the window; Codex composer accepts clipboard paste + Return in display-scope mode only; lane reports are mirrored at `4robots/HARDCODE/gate4-work/reports/<TAG>.md`. Merge identity for non-fast-forward merges = `git merge-tree --write-tree main branch` tree hash, never an empty diff vs the branch.
