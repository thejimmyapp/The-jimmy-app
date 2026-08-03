# Local-to-Web Merge Audit

The production target is the FastAPI/React application. The Streamlit app remains a reference implementation while useful domain modules are migrated into the web architecture.

| Capability | Local | Web | Source of truth | Conflict risk | Merge strategy |
|---|---:|---:|---|---|---|
| Chess.com public import | Yes | Yes | Web backend | Low | Keep FastAPI route and reuse `thejimmyapp` parsers. |
| Credential-free two-board import | Yes | Yes | FastAPI paired-PGN route | High | Keep completed paired-PGN import; do not accept copied sessions or reusable credentials. |
| Coupled Bughouse reconstruction | Yes | Yes | `thejimmyapp` | High | Reuse the tested transfer and promoted-pawn rules. |
| Two simultaneous boards | Yes | Yes | React | Medium | Preserve the React dual-board workspace on desktop. |
| Pockets and clocks | Yes | Yes | `thejimmyapp` + React | High | Render reconstructed snapshots without duplicating pockets. |
| Shared A/B timeline | Yes | Yes | React/FastAPI | Medium | Keep a single global ply and synchronized WebSocket events. |
| Legal exploration and drops | Partial | Yes | React/FastAPI | High | Keep server-validated moves and partner transfers. |
| Shared annotations and presence | No | Yes | Web | High | Preserve room WebSockets and versioned events. |
| Fairy-Stockfish | Yes | Yes | Combination | High | Keep the tested adapter and bounded async queue. |
| Coaching statistics | Yes | Yes | `GameService.player_stats` + React | Medium | Web dashboard includes form, colors, ratings, partners, opponents, coverage and recurring leaks. |
| Opening Explorer | Yes | No | Local modules | Medium | Add a dedicated web route and view in a later slice. |
| Pattern Academy | Yes | Partial | Combination | Medium | Keep the web puzzle player and expand from local motifs. |
| Coupled local AI coach | No | Yes | Fairy + coupled analyzer + Qwen | High | Load stored replay positions server-side, render facts deterministically, and show Qwen commentary only after structural validation. |
| Railway deployment | No | Yes | Web | High | Keep Docker, Alembic, static serving and Railway health checks. |

## Migration order

1. Preserve the FastAPI/React deployment and collaboration architecture.
2. Centralize the two-board coaching context in the backend.
3. Keep the local Qwen Team Coach as an optional explanation layer after deterministic analysis.
4. Bound public compute queues and expire completed job records.
5. Harden health reporting and engine failure states.
6. Verify the dual-board layout across desktop, tablet and mobile.
7. Migrate Opening Explorer and advanced training as independent product views.

## Deliberately retained legacy code

`app.py` is not removed during this migration. It remains the behavioral reference for coaching reports, training queues, Opening Explorer and Pattern Academy until each area has equivalent web tests.
