# The Jimmy App reconciliation ledger

Date: 2026-08-01 (America/Los_Angeles)

Scope: reconcile Jimmy's statistics/local-Qwen production line with Ryan's completed-game, credential, legal, deletion, OAuth, and replay-integrity safeguards. This branch is for review only; it has not been deployed or merged to `main`.

## Current truth

- **VERIFIED — live:** Railway deployment `bedc3822-3d5e-460a-bd12-c526661e9dad` is running commit `cf075f2d02eb5ff8d9faba9a49b9c9ff4bd30871` from `main`. `/health` returns 200; the database, Fairy-Stockfish, and downloaded Qwen runtime report available. The attached `/app/data` volume uses 3545.7 MB of 5000 MB.
- **VERIFIED — live regression:** production exposes `/api/chesscom/enrich`, `ChessComEnrichRequest`, client-supplied analysis FENs, and client-supplied Coach board/engine facts. The submitted OAuth callback is not implemented; `/privacy`, `/terms`, and the callback fall through to the generic SPA shell.
- **VERIFIED — product:** Jimmy's Statistics, leak map, responsive header, coupled Team Coach, Fairy-Stockfish, and local Qwen GGUF path are real and preserved on this branch.
- **VERIFIED — safety record:** Ryan's branch removes copied-session intake, enforces completed games and stored analysis snapshots, bounds Chess.com PubAPI access, adds legal pages, a tested deletion workflow, replay-integrity disclosures, and the reserved pending OAuth callback.
- **VERIFIED — Chess.com request:** Ryan Ackerman (`RyanTime`) submitted the official request on 2026-07-28 using `hello@thejimmyapp.com`, selected **No** for Connected Board, and submitted `https://jimmyapp-production.up.railway.app/api/oauth/chesscom/callback`. Google Forms reported **Your response has been recorded**.
- **UNKNOWN — Chess.com response:** no exact response is preserved. A previous narrow search found no response in the checked mailbox, which was not proven to be the complete `hello@` mailbox.
- **VERIFIED — domain:** Namecheap DNS publishes the requested apex CNAME and `_railway-verify` TXT. Railway reports traffic propagated, ownership false, and certificate `ISSUING`. TLS still presents `*.up.railway.app`, not `thejimmyapp.com`. No retry was performed while issuance was active.
- **VERIFIED — this branch:** the merge retains both product lines, removes credential intake, makes engine/Coach positions server-authoritative, bounds compute jobs, and makes Qwen commentary subordinate to deterministic facts.

## Branch graph and timeline

```text
38a9fff  Make Codex connector prompt account-neutral
├─ Jimmy / AlfaSwing (6 commits, July 29)
│  4043eeb  Team Coach
│  b8dcef9  Qwen + statistics
│  7177f37  direct Qwen response
│  f0f5a8c  bounded chat template
│  4b4c874  output cleanup
│  cf075f2  leak-map action + responsive header  ← live main
└─ Ryan (13 commits, July 27–28)
   2c1bcc2 … f8a9394  replay, paired PGN, safety/legal
   53cc66f             prior main reconciliation
   4fd7e9e             deletion workflow
   4020d07             pending OAuth callback
   896b0b8             submission record
   7914034 … 2b68221  domain/evidence/review lesson
                         ↘ merged non-squashed into codex/reconcile-qwen-safety
```

Shared base: `38a9ffff09ba6096c65662df7839ab1738d73a4c`. Main is six commits ahead; Ryan's branch is thirteen commits ahead; neither source branch contains the other.

## File-by-file merge resolution

| File | Resolution |
|---|---|
| `.env.example`, `backend/config.py` | Kept Chess.com import/cache bounds and Qwen settings; added active-job, record, cache, and TTL limits; reduced default Qwen context/output/timeout to 4096/384/180 seconds. |
| `.gitignore` | Kept GGUF/llama ignores and removed the tracked-secret exception. |
| `Dockerfile` | Kept official Fairy-Stockfish plus local llama.cpp runtime and volume-backed GGUF model. |
| `README.md`, `PORTABLE_APP.md`, `docs/MERGE_AUDIT.md` | Removed copied-session guidance; documented paired PGNs, local Qwen's subordinate role, deterministic rendering, and compute bounds. |
| `backend/main.py` | Combined health/statistics/Coach/leak-map routes with OAuth, trusted hosts, completed-game checks, stored analysis, and 429 queue handling; omitted `/api/chesscom/enrich`. |
| `backend/schemas.py` | `AnalysisRequest` forbids FEN fields. `CoachPrepareRequest` accepts only stored game/ply, a question, and non-authoritative annotations; extra board or engine fields are rejected. |
| `backend/services.py` | Preserved statistics and lessons; analysis loads stored completed-game snapshots; job/cache storage is bounded. |
| `backend/coach.py`, `backend/coach_jobs.py` | Board state and engine results are server-derived. Qwen receives a fact catalog, not browser-asserted chess truth. |
| `backend/coach_output.py` | New strict JSON/fact-ID validation and deterministic rendering of side to move, move/evaluation, clocks, transfers, missing data, and urgency. Invalid commentary is withheld. |
| `backend/job_control.py`, `backend/leak_map_jobs.py` | New process-local queue caps, record caps, terminal-job TTL cleanup, and safe 429 behavior. |
| `frontend/src/App.tsx` | Combined Review/Statistics/Coach responsive UI with paired-PGN modal, legal links, replay notices, and review lesson; removed the copied-session modal. |
| `frontend/src/api.ts`, `frontend/src/types.ts`, `TeamCoach.tsx` | Client cannot submit FENs or engine suggestions to Coach; the UI displays deterministic results even when Qwen fails validation. |
| `frontend/src/components/BoardPanel.tsx` | Kept stored-position engine requests and disables analysis on exploratory branches. |
| `frontend/src/styles.css` | Preserved responsive Review/Statistics/Coach styling and policy-page styling; removed Ryan's obsolete small-screen “hide app” rule. |
| `tests/test_web_api.py` | Combined route, host, CORS, WebSocket, full-volume, exploration, OAuth, credential-removal, and stored-authority tests. |
| `app.py` | Removed credential-client paths; restored the source-neutral database helper for detecting already-stored partner-board data. |

The four textual conflicts were `backend/main.py`, `frontend/src/App.tsx`, `frontend/src/styles.css`, and `tests/test_web_api.py`. All other overlapping files were audited for semantic auto-merge errors.

## Public security contract

| Contract | Current live main | Ryan branch | Reconciled result |
|---|---|---|---|
| Copied cURL/cookie/CSRF intake | Exposed | Removed | Removed; route/schema/client/parser/example absent |
| Completed paired-PGN import | Regressed to old connector | Present | Present and tested |
| Engine position authority | Browser FEN or stored ID | Stored completed game + ply | Stored completed game + ply; extra FEN rejected |
| Coach position/engine authority | Browser board FENs and suggestions | No Coach | Stored completed game + ply; server runs Fairy-Stockfish |
| Legal routes/links | SPA fallback | Dedicated pages | Dedicated pages and persistent links |
| Deletion workflow | Absent | Tested manual tool/runbook | Preserved |
| OAuth callback | SPA fallback | Explicit pending JSON | Explicit pending JSON; no scopes/tokens enabled |
| Chess.com archive behavior | Unbounded legacy behavior | Serialized, cached, capped, polite, safe 429 | Preserved |
| Public local-model jobs | Semaphore only; unbounded queue/records | N/A | Active caps, record caps, TTL cleanup, 429 with `Retry-After` |
| Qwen factual boundary | Prompt prose only | N/A | Fact-ID JSON, post-generation validation, deterministic fact rendering |

## Qwen and factual-integrity benchmark

### Real production baselines

| Position | Inference | Findings |
|---|---:|---|
| Starting position, stored game `160643`, both boards, clocks unavailable (2026-08-01) | 152.7 s | Qwen repeated `g1f3` for both boards “simultaneously” and claimed no clock pressure although every clock was `-`. |
| Previously audited midgame position (2026-07-29) | 151.2 s | Qwen changed side to move based on board orientation, repeated one move on both boards, and claimed no time pressure while clocks were missing. |

### Reconciled post-generation boundary

These are controlled validation benchmarks, not local model-inference timings; no local GGUF/runtime exists in the checkout and this branch was not deployed. Each number is the mean of 10,000 runs of `scripts/benchmark_coach_integrity.py`.

| Case | Mean validation latency | Injected unsafe claim | Result |
|---|---:|---|---|
| Starting position | 0.011 ms | raw move on both boards | Rejected; stored/engine facts rendered |
| Midgame capture/transfer | 0.011 ms | nonexistent transfer fact ID | Rejected; verified transfer rendered |
| Missing clocks | 0.048 ms | “no time pressure” | Rejected; clocks rendered unavailable |
| Missing Board B | 0.042 ms | invented Board B attack | Rejected; Board B rendered unavailable |
| Engine mate signal | 0.015 ms | rewritten mate count | Rejected; engine mate signal rendered deterministically |

The new 4096-context/384-token/180-second generation defaults are intended to reduce latency, but their real Railway latency remains **UNKNOWN** until an approved deployment benchmark.

## Data provenance and remaining Chess.com dependency

- Public username import uses read-only Chess.com profile and monthly completed-game archives. Chess.com may omit the partner board.
- Complete paired-PGN paste is the supported credential-free path when both boards are available.
- Existing stored `raw_json` may contain historical `bughousePartnerPgn`, partner names/ratings, or a legacy `chesscom_pgn_info` object. The reconciled app may read those already-stored non-credential fields for replay/statistics, but no active pgn-info client, credential parser, or enrichment route remains.
- Missing Board B, clocks, pockets, move ordering, or engine evidence remains explicit. Sample fixtures are test-only and are not a production dependency.
- Official/user-authorized complete Bughouse data access remains pending Chess.com guidance.

## Verification record

- Backend: 92 pytest tests pass; one upstream FastAPI/Starlette `TestClient` deprecation warning remains.
- Python correctness lint: Ruff `E4,E7,E9,F` passes in isolated mode. The repository has no checked-in Ruff configuration; Ruff 0.16's broader default reports pre-existing style rules outside this reconciliation scope.
- Frontend: 11 Vitest files / 23 tests pass; ESLint passes; TypeScript/Vite production build passes.
- Static contract tests verify removal of enrich route/schema/client authority and rejection of FEN/engine extras.
- Integrated local UI: public username state, completed paired-PGN import, both board orientations, five-frame synchronized replay, Statistics, Team Coach, Privacy, Terms, and 390×844 responsive Review/Statistics all pass; no browser warnings/errors.
- Docker CLI is unavailable locally, so an image build was not run. The multi-stage Dockerfile was preserved and the frontend production artifact built successfully.

## Production rollout and rollback

1. Human reviews the draft PR, security-contract diff, test record, and visible UI.
2. Confirm a current volume/database backup and record the active deployment before merge.
3. Merge only after approval; Railway auto-deploys `main`.
4. Smoke-test `/health`, OpenAPI contract, OAuth callback, legal routes, paired-PGN import, replay, Statistics, and Team Coach with one bounded inference.
5. If only Qwen fails, disable Qwen while retaining the merged safety/legal surface.
6. If the service fails to boot, deploy the last known safe Ryan head (`2b68221`) as the temporary fallback. Avoid treating `cf075f2` as a normal rollback because it restores the credential/FEN regressions.
7. Do not change DNS, mail records, the volume, or billing during this rollout.

Recommended separately, after Jimmy returns: protect `main` with PRs, one approval, required backend/frontend checks, and no force pushes.

## Draft issue update — #7

> Update (2026-08-01): the official Chess.com OAuth / Connected Board Request was submitted on July 28 by Ryan Ackerman (`RyanTime`) using `hello@thejimmyapp.com`, with **No** selected for Connected Board and callback `https://jimmyapp-production.up.railway.app/api/oauth/chesscom/callback`. Google Forms confirmed: **Your response has been recorded**. The older “not submitted” comment is stale.
>
> July 29 direct work on `main` unintentionally restored the copied-session connector and client-authoritative analysis/Coach fields because it was built from the pre-safety shared base. The draft reconciliation PR preserves Statistics, leak map, Team Coach, Fairy-Stockfish, and local Qwen while removing credential intake and restoring stored completed-game analysis, legal/deletion work, and the pending OAuth callback.
>
> Keep this issue open until the reconciliation PR is approved, merged, deployed, and the supported/user-authorized Chess.com data route is resolved.

## Draft issue update — #13

> Production remains deployment `bedc3822-3d5e-460a-bd12-c526661e9dad` at commit `cf075f2` on the Hobby plan. The `/app/data` volume is READY at 3545.7/5000 MB and contains the 2.71 GB Qwen GGUF.
>
> DNS is correct and propagated: apex CNAME points to `17drm471.up.railway.app`, and the requested `_railway-verify` TXT is public. Railway still reports ownership `false` and certificate `ISSUING`; direct TLS still presents `*.up.railway.app`. No certificate retry was performed while issuance was active. Keep the issue open until `https://thejimmyapp.com` presents a valid apex certificate, or split the certificate problem into a dedicated issue before closing the older outage record.

## Draft Discord message to Jimmy

> Your Statistics, leak-map, responsive UI, and local Qwen/Fairy Team Coach are real—the live model worked end to end, and I measured it again at 152.7s. The issue was branch divergence, not the value of either body of work: your six commits and Ryan's thirteen safety/OAuth/legal commits both started from the same older base, so deploying main brought the older connector and client-FEN contracts back. I preserved both lines in a test branch, moved Coach truth back to stored game snapshots + Fairy/transfer validation, and made Qwen commentary fail closed behind deterministic facts. Next step is review of the reconciliation PR, not another rewrite; nothing in this branch has been merged or deployed.
