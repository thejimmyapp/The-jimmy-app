# The Jimmy App Import Onboarding Improvement Report

## Context

The cURL problem is solved for this incident, but not yet for the product. The screenshots and Discord thread show a fragile user journey:

- The user had to open Chess.com, open DevTools, use Network/Search, and identify the right request.
- Browser language mattered. The Windows screenshot used French Chrome (`Réseau`, `Rechercher`, `En-têtes`).
- Searching for `PGN` surfaced JavaScript bundle matches instead of the `pgn-info` request.
- Authenticated enrichment appeared to be a required advanced file-path setup step.
- An SSL certificate failure appeared to the user as the same general import failure.

Users should not need to understand Chess.com internals, browser DevTools, cookies, CSRF tokens, or cURL syntax before seeing value from The Jimmy App.

## Product Goal

1. A user enters a Chess.com username.
2. The app imports public Bughouse data when possible.
3. The app clearly identifies full two-board mode or limited single-board mode.
4. Authenticated enrichment is optional, validated in-app, and can be added later.
5. Import failures lead to useful recovery choices instead of raw exceptions.

## Recommended Flow

### First Run

1. Ask for the Chess.com username and explain that public import does not need cURL.
2. Run public archive import and continue to the dashboard when it succeeds.
3. If it fails, offer Retry, Continue offline, Upload PGN, Paste PGN, and Troubleshooting.
4. Show two-board enrichment as an optional status: missing, ready, or expired.
5. Detect Fairy-Stockfish and let the app continue when engine analysis is unavailable.

### Import Recovery

Use one recovery surface for SSL, Chess.com HTTP/rate-limit, missing or expired cURL, and parser failures. Keep technical details in logs and give the user a short diagnosis plus a next action.

## cURL Handling

The app should accept a text upload or pasted cURL, validate it locally, save it under `secrets/`, and redact cookies and tokens from UI and logs. Keep the existing file path as a compatibility option, not the primary interaction.

Support these common formats:

- Chrome, Edge, and Brave "Copy as cURL (bash)".
- Windows CMD caret continuations and PowerShell backtick continuations.
- Single quotes, double quotes, CRLF, and repeated headers.
- Cookie headers, `-b`, and `--cookie`.
- `--data-raw`, `--data`, `--data-binary`, and `--json`.

Validation should distinguish cookie, CSRF token, expected endpoint, and request body. A later iteration should add a live one-game test and verify that partner-board fields are returned.

## Manual PGN Import

Manual PGN should be a first-class fallback rather than a hidden side feature. Expose Upload PGN and Paste PGN during setup and keep them available later. Accept PGN from Chess.com share dialogs and Bughouse Viewer, preview the detected players and boards, and preserve source metadata.

This directly addresses the incident where a usable Bughouse PGN was available through another route while authenticated import was blocked.

## SSL and Certificates

Use a `certifi` HTTPS context for every Chess.com HTTP client, detect `CERTIFICATE_VERIFY_FAILED`, and offer PGN import or offline mode. This is cross-platform reliability work, not only a Mac fix.

## French-Friendly Setup

Translate setup, import recovery, cURL validation, and troubleshooting first. When DevTools instructions are unavoidable, use Chrome's French labels: `Réseau`, `Rechercher`, `En-têtes`, and `Copier en tant que cURL (bash)`.

DevTools should remain an advanced fallback. The normal path should stay inside The Jimmy App.

## Chrome Extension

An extension may eventually reduce friction, but it adds installation, permissions, browser support, updates, and privacy concerns. First ship in-app validation, manual PGN fallback, and bilingual instructions. Revisit an extension only if users still fail after those changes.

## Earlier Local Scope, Reassessed

- **Bughouse PGN import:** Essential and should become first-class.
- **Interleaved 1A/1B parsing:** Essential, with fixtures from real Bughouse PGNs.
- **Partner-board PGN support:** Essential for accurate replay and coaching.
- **Mac HTTPS/certificate fix:** Correct direction, but should cover all Chess.com clients and platforms.
- **cURL parsing robustness:** Important, but useful only alongside a lower-friction product flow.
- **Optional Mac launcher:** Useful, but lower priority than Windows-friendly and French-friendly setup.
- **Exclude `.agents/`:** Correct; agent scratch files should not ship.
- **Keep `secrets/chesscom_pgn_info_curl.txt` out of Git:** Mandatory because it can contain private cookies and tokens.

## Priority

P0 is recoverable setup: optional cURL, in-app upload/paste and validation, explicit certificates, manual PGN fallback, and useful failure choices.

P1 is trust: parser fixtures, public-import tests, manual-import tests, two-board status tests, SSL classification, and a sanitized diagnostic export containing app/OS versions and redacted import status.
