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
- [x] LAND-03: quest top bar (countdown + n/3 from the server count), completion state, Sign up → the existing claim form (merge 6c0b94a). A5, A6 verified on production 2026-09-07 by the gate as guest #542.
- [x] LAND-04: scrapped entry surface deleted (OnboardingMap, Word Vertigo, entry copy, 55 selectors + 3 keyframes), DEV-RUN entry paragraph updated, exactly one Log in/Sign up pair in every state (merge bc6f967). A9 plus A1–A3/A8 regression verified on production 2026-09-07 (guests #542, #548).
- [x] UX-01: dock Moves sub-tab unmounted, Map button removed, "Droppers" label removed (pocket rails named "White pocket" / "Black pocket"); merge b132655; verified on production 2026-09-07 by the gate (tabs Info · Second Board, no Map, four pocket labels, ←/→ stepping intact).
- [x] DOCS-01: every docs/ file classified; 20 superseded files carry a one-line banner; START-HERE.md is the CURRENT/HISTORICAL index (merge 6cd4ffc).

## 🚧 Active

- [~] SHELL-01 (Lane 3): SUPERSEDED 2026-09-08 by UX-06 (Lichess Study parity); branch 899e48b left unmerged, not deleted.
- [x] LIST-01/02/03 (Lane 4): guest list by rating class (merges bdfa120, 49c7004, 7b4b3e3); verified on production 2026-09-07/08.
- [x] OBS-01 (Lane 2): read-only Railway log pass 2026-09-07 21:40Z — deploy bdfa120 SUCCESS, no 429/ERROR, first build hit the 60 s budget with 31 validated matches; app INFO logs are not emitted under uvicorn's default root level (LOG-01 candidate).
- [x] BOARD-01 (Lane 3): registry-driven board appearance, Cburnett + Wood Classic defaults, legacy ids preserved (merge a007918); verified on production 2026-09-08.
- [ ] UX-06 PARITY program (Lane 4, file channel): 01 board surface with chessground-compatible grammar + Playwright/pixelmatch harness (merge 7dbf450) · 02 Crazyhouse pockets, frozen anonymous reference, layout presets, brown flat theme, fork arrows (0d07433) · 03 own PGN parser + Crazyhouse tracker + study move tree (27dbaa3) · 04 NAG symbols, measured keyboard grammar, controls, 1200/1024 presets (e8c6fc7) · 05a StudyWorkspace wired to review state behind ?ui=study, default OFF (a430267; verified on production 2026-09-09 — default path unchanged, flag path functional) · 05b per-board synchronized move lists + real SAN (e490001) · 05c layout frame presets for the AppShell box (f9b3e39) · 05d player bars (74a7d69) · 06a underboard: Save moment / Library / Match info (8a25ad4) · 06b rulings (ddb4417) · 06c study menu (Flip / Brown|Wood / Classic view) + side collaborate box (ac75e42) · 06d collaborate panel hosted in the study side + 06b-ADD2 engine row (Fairy-Stockfish, own 44 px band, no overlay, `?eval=none` preview) (f9573de; verified on production 2026-09-09 under the flag: moves +44 OFF / +70 ON, pockets and controls anchored) · remaining: 06e rail/dock mapping, default flip (owner), `owner` zoom preset, controls' left slot, material diff, exploration-mode variations. Visual record vs the frozen reference @0.1: board ≤1.2 %, coords 2.3 %, pockets 4.4–5.5 %, moves ≈11 % (Lichess's private Noto Chess font). Prod findings 2026-09-09 driving 05b/05c: page-based presets clip the tools column inside the 1372×842 stage box; two-board timeline collides in the move-number-keyed column renderer (38/69 nodes); decoder move strings are not SAN.
- [x] UX-07 USAB-01/02/03 (Lane 5, file channel): wizard alternative board given a definite stage height (`.wizard-step__board-moves .board-stage { aspect-ratio: 506 / 602 }`, cockpit untouched) + matchup cards select by click/Space/Enter through the listbox path + Playwright wizard-board check (merge fb391e3) · wizard-level Cancel reachable at every step (2bf4adb) · glyph tiles are real buttons (ca3d4d6). Production acceptance 2026-09-09 by Lane 5's isolated Playwright Chrome with strict real pointer input: guests #593 (1440×900, 125 s) and #594 (1024×768, 113 s) each published 3/3 learning moments (POST /api/moments 201 ×3, `completed: true`); earlier guests #591/#592 did the same on M18 with one native-select ruling. Gate's definition of done ("a new user can publish three moments") MET.
- [x] USAB-E2E (Lane 5): offline Playwright guest-journey regression `pnpm usability:journey` against the real local FastAPI with a FakeMatchups adapter (real /store, /exploration/move, /moments; 201 ×3; visible 3/3; default and Study at 1440×900 and 1024×768; source guard forbids keyboard/select/API/state shortcuts; loopback-only audit; negative controls fail at the board and the card) — merge 213d0b2 (M22); gate-run PASS 2026-09-09 22:01Z. Gate #5 stopping point 2026-09-09 22:10Z: kickoff queue §5.1–5.3 complete; §5.4 parity continuation and all owner calls await Ryan.
- [ ] TEST-01: guestReplay.integration.test.tsx hit its 5 s timeout under host load in two lanes on 2026-09-07 (gate goldens green) — raise its own timeout or split it.
- [ ] LOG-01: emit the backend logger at INFO so "Guest matchup list assembled" reaches Railway.
- [x] Separate the UI library from the public application bundle.
  - Evidence at bc6f967: no frontend/src/blocks.tsx, no frontend/public/blocks/, no blocks entry in vite.config.ts; production /blocks/index.html returns the SPA shell (UILIB-02, merge 5565276). Verified by the gate 2026-09-07.
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

**A7 — Landing rebuild — COMPLETE 2026-09-07.** Owner scratch notes 2026-09-05 → `docs/SPEC-landing-2026-09.md`:
real landing page (carousel, Log in / Sign up top-right, massive Start), timer
starts on Start, quest top bar with countdown + 0/3 checklist, then the matchup
list. Chunks LAND-00…06; Lane 3 builds, Lane 4 owns Log in after the
credential-intake ruling, Lane 2 merges serially.

GUEST-STORM (2026-09-07, Lane 2 railway logs + gate code read): guest counter 53→509 overnight was not a crawler. App.tsx:309-312 starts the 5-minute timer on landing render, App.tsx:368-393 calls POST /api/guests/reset on expiry, backend/main.py:336-340 mints a new guest row unconditionally, and the client returns to the entry phase, which restarts the timer: one guest per ~5 min per idle landing tab. Resolved by LAND-02 (timer starts on Start); guarded by acceptance A7. Server-side backstop (no new row when saved_moment_count == 0) is an open owner call, default no.

LAND-02 production acceptance (2026-09-07, gate walk as guest #529 on www after merge a3422f6): A1, A2, A3, A4, A7, A8 pass — carousel replaces the entry card, Log in / Sign up disabled with SIGN_IN_NOTICE, Start only on slide 4/4 and mouse-reachable, questDeadline null until Start then now+5 min, expiry fired exactly one POST /api/guests/reset and twelve idle minutes on the carousel fired none, rail + dock inert in both phases. Remaining for A7 closure: A5, A6 (LAND-03) and A9 (LAND-04).

LAND-03 and LAND-04 production acceptance (2026-09-07, gate walks on www): A5 — after the first save the bar read 1/3 from the refreshed server session with no reload; A6 — after the third save 3/3, countdown removed, questDeadline null, POST /api/guests completed=true (completion_ordinal 2), Sign up enabled and the claim form (#guest-account-email) reachable by mouse inside #app-stage-panel (backdrop pointer-events auto); A9 — golden green, deleted tests listed and diffed; regression after LAND-04 as guest #548: A1–A3, A8, matchup heading styled by .guest-matchup-copy, .onboarding-map-shell intact; completed guest #542 sees exactly one Log in/Sign up pair. A1–A9 all pass. Still open under the landing: carousel copy and imagery (owner) and LAND-06 Log in (after the credential ruling). Gate walks consumed founder completion ordinals #1 (guest #50, 2026-09-05) and #2 (guest #542, 2026-09-07); founder_eligible is ordinal ≤ 10 (backend/main.py:153) — owner call whether test completions count.

**A6 — Return path.** A new user can now land, load a game in under a second,
save three moments, grade them, and reach the claim form with a mouse. What is
missing is the way back (credential intake, held P0) and a definition of what an
account unlocks (see `docs/GATE-4-HANDOFF.md` §4). Nothing to build until the
owner rules.

LAND-05 memo merged 8396a08 (docs/MEMO-credential-intake-2026-09.md): magic link · email + password · Chess.com OAuth, each with the Privacy Policy and Terms edits it requires. Finding: the live claim form already collects an email and sets an account cookie while LegalPage.tsx:66 and :110 state the service has no user accounts — the policy needs that disclosure before any option, including the existing claim. Owner ruling pending.

LEGAL-01 memo (docs/MEMO-legal-delta-2026-09.md, merge pending): exact Privacy Policy and Terms replacement text for the live claim flow (guest-identity paragraph, corrected storage paragraph, cookies item, claimed-identity terms clause, effective-date eyebrows, claim-form disclosure line). Owner approval pending; LEGAL-02 applies the approved text, adds the claim-form line, and rewrites operations/data-deletion-runbook.md as a current procedure.

LIST-01/02/03 production acceptance (2026-09-07/08, gate walks on www): three rows in class order 2300+ / 1900–2300 / 1400–1900, freshest finished game per class, floor 1400; Regenerate rotates within class from the pool with zero upstream calls and reports classes that could not rotate; keyboard selection opens the replay. LIST-01 shipped with a global examined cap that let the roster starve the top class (placeholder observed 22:24Z, 1 of 5 snapshots); LIST-03 scopes the ladder to each class's seeds, shares the cap per class with rollover, exempts cached matches, and stops top_up at the cap — after M3 the cap holds (examined_upstream 40) with all classes filled. LIST-02 also filtered placeholder rows out of the saved-moment and permalink lookups (latent crash).

BOARD-01 production acceptance (2026-09-08, gate walk): fresh guest gets data-board-theme=wood-classic and data-piece-set=cburnett with the registry's CSS variables inline; 32 SVG pieces per board with role=img and colour/piece aria-labels, no glyph text; pockets render SVG pieces with count badges; saved legacy ids (slate, solid) still apply. License: Commons file pages offer GFDL / CC BY-SA 3.0 / BSD-3-Clause / GPL-2.0+ ("select the license of your choice"); BSD-3-Clause chosen, full notice reproduced in THIRD-PARTY-NOTICES.md and linked from the Notices page.

UX-06 — Lichess Study parity (2026-09-08 →). Frame rule: Lichess's #top header is 60 px at every width and Jimmy's topbar replaces it, so a workspace box W×H is the Lichess viewport W×(H+60) and measured coordinates map as (x, y−60); Jimmy boxes 1372×842 / 1132×742 / 956×710 for 1440×900 / 1200×800 / 1024×768 viewports (rail 52 + gap 4 + buffer 6; topbar 46; under 992 px the small-screen message). Release criterion per slice: fixed-viewport capture, side-by-side with the frozen reference, geometry Δ ≤ 1 px, mismatch recorded; production walk behind the flag.

## Update format

```text
ACTOR — YYYY-MM-DD HH:MM TZ
VERIFIED:
EVIDENCE:
BLOCKER/DECISION:
NEXT:
```
