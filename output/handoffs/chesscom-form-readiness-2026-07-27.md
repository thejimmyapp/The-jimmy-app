# The Jimmy App — Chess.com Form Readiness Report

Date: 2026-07-27

Repository: `/Users/user/Documents/Jimmys-App`

Production URL checked: `https://jimmyapp-production.up.railway.app/`

## 1. IMPLEMENTATION SUMMARY

### What changed

- Added unauthenticated `/privacy` and `/terms` React routes with accurate
  disclosures for the current application.
- Added persistent Privacy and Terms links to the main application and puzzle
  headers.
- Removed the public copied-session workflow end to end:
  - deleted the frontend control and API call;
  - deleted the FastAPI request schema and route;
  - deleted the credential parser/client module;
  - deleted the example copied-cURL secret file;
  - removed the legacy Streamlit control and public instructions.
- Added completed-game enforcement:
  - Chess.com imports use only completed monthly archive records with terminal
    result signals;
  - manual PGNs must contain a terminal result, and the importing username must
    be a Board A player;
  - incomplete stored games are hidden and cannot be reviewed;
  - Fairy-Stockfish accepts only a stored completed-game ID and ply, then loads
    the position server-side. The arbitrary client-supplied FEN path was removed;
  - engine analysis is disabled while the UI is on an exploratory branch.
- Added bounded PubAPI behavior:
  - requests are serialized within the application process;
  - responses are cached by username for 15 minutes by default;
  - archive retrieval is limited to the most recent 12 archive months and 500
    completed Bughouse games per connection by default;
  - archive requests pause 250 ms between calls;
  - a `429` stops the import without an automatic retry and reports
    `Retry-After` when Chess.com supplies it.

### Why it changed

The previous production-facing workflow accepted copied Chess.com cookies and
CSRF/session material. It contradicted the proposed outreach and created an
unnecessary account-security risk. The analysis endpoint also accepted an
arbitrary FEN from the browser, so UI copy alone could not substantiate a
completed-game-only claim.

### Production readiness

The reconciled code and deployed Railway application pass the technical P0
checks. Deployment `0279a85b-6445-4628-a4f9-fb4820aa86c6` completed
successfully from commit `53cc66f` after merging the current `origin/main`
full-storage protections. Production health is green, `/api/chesscom/enrich`
is absent, the engine request schema no longer accepts client FEN fields, the
credential-free paired-PGN UI is live, and both legal pages render.

The tested deletion workflow was subsequently deployed successfully as
deployment `9921dff3-fb09-4336-8ec7-0a67aebf484d` from repository commit
`4fd7e9e`.

The remaining submission decisions are operational/owner facts rather than
technical P0 failures: commercial status, operator identity/jurisdiction, a
named deletion-request inbox operator with Railway access, and the desired
retention/no-bulk disclosure. A tested deletion tool and operator runbook now
exist in the repository.

## 2. FILES CHANGED

| Path | Purpose | Change |
|---|---|---|
| `.env.example` | Deployment defaults | Added cache/import bounds and corrected the Chess.com contact user-agent. |
| `.dockerignore` | Deployment context | Excluded local `output/` verification artifacts from Railway/Docker uploads. |
| `.gitignore` | Secret handling | Removed the exception that kept a copied-cURL example tracked. |
| `PORTABLE_APP.md` | Local documentation | Replaced authenticated-session instructions with completed paired-PGN guidance. |
| `README.md` | Public repository claims | Removed copied-session instructions and aligned documentation with supported public/paired-PGN flows. |
| `app.py` | Legacy Streamlit app | Removed copied-session enrichment setup, controls, imports, and execution paths. |
| `backend/chesscom.py` | Chess.com PubAPI client | Added completed-game filtering, serial access, process-local caching, bounded imports, polite delay, and safe `429` handling. |
| `backend/config.py` | Runtime configuration | Added cache/import limits and the real project contact address. |
| `backend/main.py` | Public API | Removed `/api/chesscom/enrich`; enforced terminal PGNs, Board A identity, completed reviews, and stored-position-only engine analysis. |
| `backend/rooms.py` | Full-storage resilience | Retained the current production in-memory room fallback when persistent room storage is full. |
| `docs/operations/data-deletion-runbook.md` | Deletion operations | Added request verification, dry-run, backup, execution, verification, and closure steps. |
| `backend/schemas.py` | Request models | Removed the copied-cURL schema and arbitrary analysis FEN fields. |
| `backend/services.py` | Review/analysis service | Rejects incomplete games and loads analysis positions only from stored completed-game snapshots. |
| `frontend/src/App.tsx` | Main UI | Added legal links, removed copied-session UI, and clarified completed paired-PGN requirements. |
| `frontend/src/api.ts` | Browser API client | Removed the enrichment call and arbitrary FENs from engine requests. |
| `frontend/src/components/BoardPanel.tsx` | Review board | Prevents engine analysis on exploratory branches and removes fallback copy. |
| `frontend/src/components/LegalLinks.tsx` | Public navigation | New reusable Privacy/Terms navigation. |
| `frontend/src/components/LegalPage.tsx` | Public policies | New Privacy Policy and Terms of Service content. |
| `frontend/src/components/PuzzlePlayer.tsx` | Puzzle UI | Added legal links and replaced “live boards” wording with “recorded boards.” |
| `frontend/src/main.tsx` | Public routing | Added `/privacy` and `/terms` route selection. |
| `frontend/src/styles.css` | Public layout | Added legal navigation and scrollable policy-page styling. |
| `scripts/generate_release_pdfs.py` | Release documentation | Removed obsolete enrichment wording. |
| `secrets/chesscom_pgn_info_curl.example.txt` | Unsafe example | Deleted. |
| `thejimmyapp/board_renderer.py` | Legacy rendered copy | Replaced copied-cURL instruction with paired completed-PGN guidance. |
| `thejimmyapp/chesscom_pgn_info.py` | Unsupported credential client | Deleted. |
| `thejimmyapp/db.py` | Game persistence | Removed dead enrichment query, hides nonterminal result rows, and retains partner-data detection without the deleted module. |
| `thejimmyapp/game_completion.py` | Completion rules | New shared terminal-result validation for PGN, PubAPI, and stored records. |
| `tests/test_game_completion.py` | Backend safety tests | New completion and incomplete-game exclusion tests. |
| `tests/test_database_startup.py` | Full-storage safety tests | Retained the production startup regression tests for an already-full legacy SQLite volume. |
| `tests/test_data_deletion.py` | Deletion regression tests | Verifies dry-run behavior and scoped deletion across imported-game and collaboration stores. |
| `thejimmyapp/data_deletion.py` | Deletion implementation | Added scoped deletion and non-content-bearing count reports for games, derived data, rooms, notes, and chat. |
| `scripts/delete_stored_data.py` | Operator command | Added dry-run-by-default execution with a required audit ID for mutations. |
| `tests/test_manual_pgn_import.py` | Replay tests | Updated fixtures to represent terminal completed games. |
| `tests/test_review_outcome.py` | Analysis safety test | Verifies engine analysis uses the server-side stored snapshot. |
| `tests/test_web_api.py` | Route safety test | Verifies the copied-session connector is absent from OpenAPI and unavailable. |
| `frontend/src/App.test.tsx` | Connector UI test | Verifies completed paired-PGN import, legal links, and absence of fallback UI. |
| `frontend/src/components/LegalPage.test.tsx` | Policy tests | Verifies key Privacy/Terms disclosures and links. |

## 3. PRIVACY POLICY ACCURACY NOTES

### Fully supported by code

- The public app has no user-account or OAuth implementation.
- The browser stores the selected username and board preferences in
  `localStorage` (`frontend/src/store.ts:39-60` and `frontend/src/App.tsx:39-58`).
- Game rows store usernames, URLs, UUIDs, end time, ratings, results, PGN, raw
  JSON, and import time (`thejimmyapp/db.py:30-52`).
- Review rooms, display-name authors, shared notes, and chat messages are
  persisted (`backend/models.py:16-48`; writes in `backend/main.py:217-306`).
- The public connector uses Chess.com’s public profile and monthly archive
  endpoints (`backend/chesscom.py:35-49`).
- The public app does not accept passwords, cookies, CSRF tokens, copied cURL
  requests, or reusable session credentials. The production route, schema,
  frontend call, parser, and example file have all been removed locally.
- Fairy-Stockfish runs in the application environment; no model-training code,
  training dependency, or training pipeline was found.
- Uvicorn/hosting infrastructure can process IP addresses and request metadata;
  IP addresses are not columns in the application databases.
- No payment, subscription, analytics SDK, advertising SDK, or email-collection
  UI was found.

### Requires manual operational practice

- Deletion is by email to `hello@thejimmyapp.com`; there is no self-service
  deletion API. An operator must identify and delete the relevant SQLite and/or
  relational database rows.
- The domain has Google MX routing, but mailbox ownership and the deletion
  response procedure were not tested.
- Railway is named as the current hosting provider based on the production URL
  and deployment configuration. Its infrastructure logging/retention remains a
  provider-level operational matter.
- Shared-room content is available to people who possess a room link. Operators
  must handle misuse/removal requests manually.

### Statements that cannot yet be made

- No guaranteed automatic deletion period can be claimed.
- `ROOM_TTL_HOURS` exists in configuration but no cleanup scheduler enforces it.
- No guaranteed deletion-response deadline can be claimed.
- No claim of encrypted application-level game fields or chat/note fields can be
  made from the repository.
- No claim that only the Chess.com account owner can request a public username
  import can be made; there is currently no authentication.

## 4. TERMS ACCURACY NOTES

### Fully supported by code

- The supported product position is post-game review and education.
- Public Chess.com imports come from completed monthly archive data and are
  filtered by terminal signals (`backend/chesscom.py:35-53`;
  `thejimmyapp/game_completion.py:53-66`).
- Manual imports require terminal results on both supplied boards and require
  the entered username to appear on Board A (`backend/main.py:90-129`).
- Incomplete stored games cannot be retrieved or analyzed
  (`backend/main.py:80-87,132-139,192-202`).
- Engine requests contain only stored game ID, global ply, board, and depth
  (`frontend/src/api.ts:49-60`; `backend/schemas.py:18-23`).
- Engine jobs reconstruct the server-side stored snapshot
  (`backend/services.py:137-157`).
- There is no Chess.com move-submission endpoint or Connected Board behavior.
- Non-affiliation language is explicit in the Terms.
- Experimental availability and absence of a current account-termination
  workflow match the implementation.

### Requires implementation or clarification

- Manual PGN completion is syntactic, not cryptographically or independently
  verified. A user could falsely give an active-game fragment a terminal result;
  the Terms prohibit this.
- The stateless exploration endpoints accept arbitrary FENs and return move
  legality, but do not run Fairy-Stockfish and do not connect to Chess.com.
- Applicable governing law, venue, and organization identity/address have not
  been specified. External/legal review may be appropriate before commercial
  launch.
- Repository licensing is not declared in a root `LICENSE` file, so the Terms do
  not promise a particular software license.

## 5. COPIED-CURL WORKFLOW STATUS

### Where it existed

- Public React modal in `frontend/src/App.tsx`.
- Browser API client in `frontend/src/api.ts`.
- FastAPI schema and `/api/chesscom/enrich` route in
  `backend/schemas.py` and `backend/main.py`.
- Cookie/CSRF/cURL parser and callback client in
  `thejimmyapp/chesscom_pgn_info.py`.
- Legacy Streamlit path/input and enrichment functions in `app.py`.
- Public instructions in `README.md`, `PORTABLE_APP.md`,
  `thejimmyapp/board_renderer.py`, and the tracked example secret file.

### Current local status

Removed, not merely hidden. The parser/client module and example file are
deleted, and no production or legacy UI/API accepts copied session material.

### Storage or logging

The removed FastAPI route previously received credential-bearing text in the
request body and parsed it in memory. The code did not intentionally write the
request text or parsed credentials to the application databases. Standard
server access logs normally record method/path/status, not the request body.
The removed legacy path read a local file. No tracked real credential file was
found; `secrets/` remains ignored.

### Remaining risk

Production no longer exposes the old endpoint. Existing untracked local files,
historical hosting logs, or external backups were not inspected. Previously
enriched game JSON can remain in a local database, but reusable request
credentials are not part of the normalized stored game payload.

## 6. CLAIM VERIFICATION TABLE

| Claim | Status | Evidence | Required correction |
|---|---|---|---|
| 1. The app operates only on completed games. | PARTLY TRUE | PubAPI filters terminal archive records; manual PGNs require terminal results; stored review/engine routes reject incomplete games. Stateless exploration accepts arbitrary FEN, and manual terminal labels can be falsified. | Deploy changes; optionally require a signed completed-game context for non-puzzle exploration if a stricter API-wide claim is needed. |
| 2. The app does not provide live analysis. | PARTLY TRUE | Engine accepts only stored completed-game IDs/plies and UI disables branch analysis. There is no active-game feed. Manual imports rely on truthful terminal metadata. | Deploy; describe enforcement precisely rather than claiming independent verification of manual PGNs. |
| 3. The app does not submit moves. | TRUE | No Chess.com POST/move endpoint exists; Chess.com service uses read-only profile/archive GETs. | Deploy and retain this boundary. |
| 4. The app does not interact with active games. | TRUE | Public connector calls profile, archive-list, and completed monthly archive URLs only. | Deploy. |
| 5. The app does not request/store Chess.com passwords. | TRUE | No password field/schema/storage path found; policy and Terms prohibit submission. | Deploy. |
| 6. The app does not request/store Chess.com cookies. | TRUE in production | Cookie/cURL parser, endpoint, UI, and example were deleted; production OpenAPI and UI were verified. | Confirm no historical credentials exist in external logs/backups. |
| 7. The app does not request/store CSRF tokens. | TRUE in production | Same removal and production verification as claim 6. | Confirm no historical credentials exist in external logs/backups. |
| 8. The app does not request/store copied cURL requests. | TRUE in production | Same removal as claim 6; production OpenAPI route is absent. | None for the current product surface. |
| 9. The app does not retain reusable Chess.com session credentials. | TRUE in production | No current intake/parser/storage path remains. | Confirm no historical credentials exist in external logs/backups. |
| 10. Public Privacy Policy and Terms pages exist. | TRUE in production | `LegalPage.tsx`; `/privacy` and `/terms` render in production. | Owner/legal review remains advisable. |
| 11. Those pages are linked publicly. | TRUE in production | `LegalLinks.tsx`, main header, and puzzle header; production DOM verified. | None. |
| 12. Retention/deletion statements are accurate. | TRUE IN REPOSITORY; OPERATOR PENDING | Policy accurately discloses no automatic period/dashboard. The manual tool and runbook are tested across both stores. | Name the inbox operator and ensure that person has Railway/data-store access before accepting requests. |
| 13. Requests are rate-limited and cached where appropriate. | PARTLY TRUE | Process-local serialization, 15-minute cache, 250 ms archive delay, 12-month/500-game bounds. No distributed/per-IP limiter or persistent ETag cache. | Optional distributed limiter/persistent cache before scale; disclose current bounds. |
| 14. `429` responses are handled safely. | TRUE | `_raise` stops without retry and reports numeric `Retry-After`. | Deploy; consider UI-specific status later. |
| 15. The app does not imply Chess.com affiliation/endorsement. | TRUE in production | Terms explicitly disclaim affiliation/sponsorship/endorsement; no Chess.com branding asset is used. | None. |
| 16. The app does not train an ML model on Chess.com records. | TRUE | No training pipeline/dependency found; analysis invokes Fairy-Stockfish inference. Policy states no training. | Keep future data use within this claim or update policy. |
| 17. The app does not build a bulk Chess.com dataset. | PARTLY TRUE | Imports are user-triggered and capped at 12 months/500 completed Bughouse games per username. Persistent storage has no global cap or automatic pruning, and arbitrary public usernames can be requested. | Add OAuth/user ownership and a retention/global-cap policy if Chess.com requires a stronger assurance. |

## 7. TESTS

### Automated

- `.venv/bin/python -m pytest -q`
  - **55 passed**
  - one dependency deprecation warning from FastAPI `TestClient`.
- `pnpm test -- --run`
  - **7 test files passed**
  - **17 tests passed**
- `pnpm run lint`
  - **passed**
- `pnpm run build`
  - **passed**
  - Vite production build generated successfully.
- `git diff --check`
  - **passed**

### Local deployment/route checks

Served the production build through Uvicorn at `http://127.0.0.1:8765`.

- `/` — 200; persistent Privacy/Terms links present.
- `/privacy` — 200; rendered policy, contact links, no horizontal overflow,
  internal scrolling works.
- `/terms` — 200; completed-game, no-live-assistance, and non-affiliation
  statements rendered; no horizontal overflow.
- Connector modal — no pgn-info/cURL/cookie field or copy.
- Paired-PGN panel — completed-game copy and both PGN inputs present.
- Browser console — no warnings or errors during legal-page checks.

### Current production checks

- Railway deployment `9921dff3-fb09-4336-8ec7-0a67aebf484d` — **SUCCESS**;
  includes the manual deletion tool and runbook.
- Railway deployment `0279a85b-6445-4628-a4f9-fb4820aa86c6` — **SUCCESS**.
- `/health` — 200 and healthy.
- `/privacy` — renders the deployed policy and deletion contact.
- `/terms` — renders completed-game, no-live-assistance, and non-affiliation
  language.
- `/openapi.json` — `/api/chesscom/enrich` is absent.
- Production `AnalysisRequest` — only `game_id`, `global_ply`, `board`, and
  `depth`.
- Main connector UI — public archive lookup plus credential-free completed
  paired-PGN import; no copied-session fallback.
- Legal pages — no horizontal overflow at the tested 1280 px viewport.

## 8. REMAINING BLOCKERS

### P0 — completed

1. Deployed the reconciled change set to the confirmed Railway production
   service.
2. Reverified the legal routes, public links, OpenAPI route removal, engine
   request schema, credential-free connector UI, and health endpoint.
3. Retained and tested `origin/main` full-volume startup and room/invite
   protections before deployment.

### P1 — should be fixed or explicitly resolved before submission

1. Confirm that `hello@thejimmyapp.com` is monitored and name an operator with
   Railway/data-store access. The tested deletion command and documented
   procedure now exist.
2. Decide whether the form should disclose that current imports are public
   username-based and unauthenticated. OAuth is being requested but is not
   currently implemented.
3. Decide whether Chess.com needs a stronger no-bulk assurance than the current
   12-month/500-game per-username bounds; there is no global retention cap.
4. Have the policy/Terms reviewed by the responsible operator or counsel before
   relying on them as legal commitments.
5. Clean up or expand the Railway volume, which reported approximately
   498.7 MB used of 500 MB. The deployed safeguards keep startup and room
   creation functional when full, but capacity remains an operational risk.

### P2 — may be disclosed or scheduled after submission

1. Add distributed inbound rate limiting and a persistent ETag-aware PubAPI
   cache before multi-instance scale.
2. Implement and test room/data TTL cleanup if an automatic retention promise
   is desired.
3. Add a self-service authenticated deletion flow after a user-account/OAuth
   model exists.
4. Add a root software `LICENSE` if public reuse terms should be explicit.
5. Complete custom-domain ownership/certificate validation before using
   `https://thejimmyapp.com`; the Railway URL is the currently verified project
   URL.

## 9. FORM-READINESS FACTS

- **Working project URL:** `https://jimmyapp-production.up.railway.app/`
  - Health verified 2026-07-27.
  - Deployment `9921dff3-fb09-4336-8ec7-0a67aebf484d` is the current verified
    build; it contains the deletion workflow on top of the hardened application.
- **Railway ownership/plan evidence:**
  - the project is in workspace `alfaswing's Projects`;
  - Ryan Ackerman's authenticated CLI session can deploy but cannot access
    workspace billing;
  - historical Railway deployment metadata labels the plan `trial`, and the
    exact 500 MB volume matches Railway's Trial/Free volume limit;
  - this does not prove that Jimmy personally owns the workspace or establish
    the current billing status. A workspace billing owner must confirm that.
- **Custom-domain evidence:**
  - authoritative nameservers are Namecheap's
    `dns1.registrar-servers.com` / `dns2.registrar-servers.com`, not cPanel;
  - the apex CNAME to Railway is propagated;
  - Railway still requires the `_railway-verify` TXT ownership record and shows
    the certificate as `VALIDATING_OWNERSHIP`;
  - Google MX handles domain email. cPanel does not resolve the Railway volume,
    Railway billing, or Google inbox-ownership questions.
- **Privacy Policy URL:**

  `https://jimmyapp-production.up.railway.app/privacy`
- **Terms URL:**

  `https://jimmyapp-production.up.railway.app/terms`
- **Connected Board answer:** `No`.
- **Completed-game enforcement:**
  - public imports come from monthly completed archives and require terminal
    PubAPI/PGN result signals;
  - manual paired PGNs require terminal results;
  - entered username must be a Board A player;
  - incomplete stored records cannot be reviewed or engine-analyzed;
  - engine positions are loaded server-side from stored game ID + ply.
- **Data collected/stored:**
  - entered Chess.com username;
  - completed public game IDs/URLs, usernames, ratings, results, timestamps,
    PGN/move data, and raw public game JSON;
  - manually submitted completed paired PGNs;
  - room IDs, display-name authors, chat messages, and shared notes;
  - derived replay/engine data in memory or cache;
  - browser username/preferences in local storage;
  - infrastructure may process IP/request metadata in logs.
- **Data not collected by the new build:** Chess.com password, cookie, CSRF
  token, copied cURL request, or reusable Chess.com session credential.
- **Retention:** no guaranteed automatic period. Persistent records remain
  until manually deleted, removed during maintenance, or no longer needed;
  browser data remains until the browser clears it; in-memory jobs/cache reset
  with the process.
- **Deletion method:** email `hello@thejimmyapp.com`; the operator verifies the
  request, previews matched counts, backs up, executes the scoped deletion
  command, and verifies zero remaining requested records. The implementation is
  tested; inbox ownership and production access remain owner confirmations.
- **Authentication model:** no application accounts and no OAuth yet. Public
  username lookup plus unguessable room-link access. OAuth is the requested
  future route.
- **Rate limiting/caching:** single-process request serialization; 250 ms pause
  between archive requests; 15-minute per-username memory cache; default maximum
  12 recent archive months/500 completed Bughouse games; `429` stops without
  automatic retry.
- **Contact email:** `hello@thejimmyapp.com`; Google MX exists, inbox operation
  not verified.
- **Current commercial status:** no payment, checkout, subscription, ad, or
  analytics integration was found. Business/commercial intent beyond the code
  is unverified.
- **Unresolved limitations:**
  - Chess.com PubAPI may omit the partner board;
  - manual PGN completion depends on truthful terminal metadata;
  - no user authentication/ownership proof;
  - no self-service deletion, automatic retention period, or global stored-game
    cap; a tested manual deletion procedure exists;
  - Railway storage volume is nearly full, though full-storage safeguards are
    deployed;
  - custom-domain ownership/certificate validation is incomplete.

## 10. RECOMMENDATION

# TECHNICAL P0 COMPLETE — OWNER/OPERATIONS CONFIRMATIONS REMAIN

The deployed application now behaves consistently with the narrow technical
claims in the form: Connected Board is **No**, the public credential boundary
is enforced, legal pages are public, and completed-game analysis is enforced
with the documented manual-PGN qualification.

Codex does not make the final send/hold decision. Before submission, Jimmy,
Ryan, and ChatGPT should confirm commercial status, legal operator identity and
jurisdiction, that `hello@thejimmyapp.com` is monitored by an operator with
Railway access, and the preferred retention/no-bulk disclosure.
