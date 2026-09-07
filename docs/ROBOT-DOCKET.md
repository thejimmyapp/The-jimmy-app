# 🎉 Robot docket

This docket celebrates evidence, not optimism. Completed, failed, blocked, and
abandoned work all stays visible.

**Current route:** Preserve -> Verify handoff -> Golden build -> Fresh Ryan-owned
deployment -> Backup/domain -> Private UI library

## 🥳 Benchmarks completed

- [x] Located the canonical repository and current `main`.
- [x] Reconciled the public-domain failure with Railway service state.
- [x] Chose a safe source redeploy that excludes local uncommitted work.
- [x] Defined “everything synced” as an observable finish line.
- [x] Established repository-local instructions for future agents.
- [x] Created a current Claude/Codex-readable handoff.
- [x] Converted Evan's role into optional, bounded portfolio opportunities.
- [x] Opened and pinned GitHub issue #19 as the robot communication channel.
- [x] Proposed a one-time dental-office concept reminder for 2026-09-07.
- [x] Received and hash-preserved Jimmy's reconstruction handoff and archaeology.
- [x] Validated the archaeology JSON, all cited commits, and all cited source/test
  paths against commit `7bf611c`.
- [x] Classified the supplied `message.txt` as an older Railway audit rather than
  the advertised takeover prompt.
- [x] Replaced the active UI-library task with the A5 takeover sequence.
- [x] FLASHCARD-01 added private saved-moment review state, an author-scoped
  grading endpoint, the documented scheduler stub, and accessible grading
  controls without modifying frozen public moments.
- [x] UILIB-02: the UI building-block catalog is out of the repository (merge
  `5565276`); the only copy is the owner's offline archive.
- [x] LAND-02: the landing carousel replaces the entry phase; the five-minute
  guest quest starts only from the final-slide Start action and expiry returns
  to an idle landing without re-arming the deadline.

## 🚧 Active

- [ ] Separate the UI library from the public application bundle.
  - Evidence at 8845e81: frontend/src/blocks.tsx is a Vite entry (vite.config.ts:46); frontend/public/blocks/ ships index.html + 3 specimens; production /blocks/index.html returns 200.
- [x] Reproduced the handoff's backend/frontend test counts from a clean worktree:
  179 backend tests and 42 files / 202 frontend tests passed.
- [x] Reproduced ESLint and the production Vite build.
- [x] Reproduced the repository's actual pinned Ruff CI gate; contradicted the
  handoff's broader unpinned Ruff command.
- [ ] Build and smoke-test one local Docker image with Qwen disabled.
- [x] Prepare one fresh Ryan-owned, single-instance deployment with durable data.
  - Evidence (Gate 4, 2026-09-05): Railway project `thejimmyapp-ryan`
    (`65513c12-b3af-4d42-ac78-cdb3c34a9ae5`), service `thejimmyapp`, volume
    `/app/data`, GitHub-connected to `main`; `/health` = `ok`, database and
    Fairy-Stockfish available, Qwen disabled.
- [x] FLASHCARD-01 recovered and shipped. The "lost" build survived as an unpushed
  local branch (`codex/flashcard-review-state` @ `765acc5`); pushed, merged
  `--no-ff` as `1c56971`, auto-deployed, `/api/moments/{id}/review` live.
- [x] Three-for-five loop verified on production as a fresh guest: three moments
  saved inside the window, `completed=true`, `completion_ordinal=1`, review
  grading persisted (`attempts=1`, `due=false`).
- [x] LIBRARY-01: the flashcard library overlay was visible but unclickable by mouse
  (`#app-stage-panel` is `pointer-events: none`; `.guest-library-backdrop` never
  restored it). One-line CSS fix merged as `adb2989`; re-verified on production
  with a real click: "Grade hard" -> `Review recorded: hard`, `attempts=2`.
- [x] Task 52 (guest list warm-up) merged as `a843dd6`. Production before: 2 games,
  `partial=true`, ~15 s cold. After: 5 games in ~114 ms, `cached=true`,
  `pool_size=23`, background build 25 s at startup with 110 upstream requests.

## ⛔ Blocked

- [x] Restore the public website on fresh Ryan-owned infrastructure.
  - Resolved 2026-09-02..05: live at `https://thejimmyapp-production.up.railway.app`.
- [x] Public hostname: [https://www.thejimmyapp.com](https://www.thejimmyapp.com) is live on the Ryan-owned service (custom domain 93ccc8f8, certificate valid). Apex thejimmyapp.com resolved 2026-09-07 via Ryan's Cloudflare account (authoritative DNS moved from Namecheap; zone a79406defec75fbddf81be167d36ef68): proxied placeholder + redirect rule [https://thejimmyapp.com/*](https://thejimmyapp.com/*) -> [https://www.thejimmyapp.com/${1}](https://www.thejimmyapp.com/${1}) (301, query preserved), Always Use HTTPS, Universal certificate active; www stays DNS-only so Railway terminates TLS. Gate-verified: [https://thejimmyapp.com/?x](https://thejimmyapp.com/?x) -> [https://www.thejimmyapp.com/?x](https://www.thejimmyapp.com/?x); [http://thejimmyapp.com/health](http://thejimmyapp.com/health) -> www /health JSON. Mail records (MX, SPF, DKIM, DMARC, Google verifications) migrated intact. Jimmy's stale Railway binding no longer blocks anything.

## 🧯 Failed attempts

- [x] 2026-08-31 source redeploy stopped before build by expired Railway trial.
  No local files were uploaded and no deployment was changed.

## 🪦 Abandoned or deliberately parked

- [x] Invisible “global Codex memory” as the coordination mechanism.
  - Reason: it is not repository-scoped, auditable, or reliably shared across agents.
- [x] Shipping the private UI library inside the public application bundle. (decision recorded 2026-09-02; not yet executed — see Active).
  - Reason: performance and access-control boundaries belong outside the public app.
- [x] Diverting active work into a dental-office website service this week.
  - Revisit after one week; do not let it fragment the recovery effort now.
- [x] Making progress dependent on Evan.
  - Evan's work is optional and bounded.

## 🔭 Next benchmark

**A7 — Landing rebuild.** Owner scratch notes 2026-09-05 → `docs/SPEC-landing-2026-09.md`:
real landing page (carousel, Log in / Sign up top-right, massive Start), timer
starts on Start, quest top bar with countdown + 0/3 checklist, then the matchup
list. Chunks LAND-00…06; Lane 3 builds, Lane 4 owns Log in after the
credential-intake ruling, Lane 2 merges serially.

GUEST-STORM (2026-09-07, Lane 2 railway logs + gate code read): guest counter 53→509 overnight was not a crawler. App.tsx:309-312 starts the 5-minute timer on landing render, App.tsx:368-393 calls POST /api/guests/reset on expiry, backend/main.py:336-340 mints a new guest row unconditionally, and the client returns to the entry phase, which restarts the timer: one guest per ~5 min per idle landing tab. Resolved by LAND-02 (timer starts on Start); guarded by acceptance A7. Server-side backstop (no new row when saved_moment_count == 0) is an open owner call, default no.

LAND-02 production acceptance (2026-09-07, gate walk as guest #529 on www after merge a3422f6): A1, A2, A3, A4, A7, A8 pass — carousel replaces the entry card, Log in / Sign up disabled with SIGN_IN_NOTICE, Start only on slide 4/4 and mouse-reachable, questDeadline null until Start then now+5 min, expiry fired exactly one POST /api/guests/reset and twelve idle minutes on the carousel fired none, rail + dock inert in both phases. Remaining for A7 closure: A5, A6 (LAND-03) and A9 (LAND-04).

**A6 — Return path.** A new user can now land, load a game in under a second,
save three moments, grade them, and reach the claim form with a mouse. What is
missing is the way back (credential intake, held P0) and a definition of what an
account unlocks (see `docs/GATE-4-HANDOFF.md` §4). Nothing to build until the
owner rules.

## Update format

```text
ACTOR — YYYY-MM-DD HH:MM TZ
VERIFIED:
EVIDENCE:
BLOCKER/DECISION:
NEXT:
```
