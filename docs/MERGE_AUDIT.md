# Local-to-Web Merge Audit

The production target is the FastAPI/React application. The Streamlit app remains a reference implementation while useful domain modules are migrated into the web architecture.

| Capability | Local | Web | Source of truth | Conflict risk | Merge strategy |
|---|---:|---:|---|---|---|
| Chess.com public import | Yes | Yes | Web backend | Low | Keep FastAPI route and reuse `thejimmyapp` parsers. |
| Authenticated two-board enrichment | Yes | Yes | Combination | High | Keep the web one-time connector and never persist credentials. |
| Coupled Bughouse reconstruction | Yes | Yes | `thejimmyapp` | High | Reuse the tested transfer and promoted-pawn rules. |
| Two simultaneous boards | Yes | Yes | React | Medium | Preserve the React dual-board workspace on desktop. |
| Pockets and clocks | Yes | Yes | `thejimmyapp` + React | High | Render reconstructed snapshots without duplicating pockets. |
| Shared A/B timeline | Yes | Yes | React/FastAPI | Medium | Keep a single global ply and synchronized WebSocket events. |
| Legal exploration and drops | Partial | Yes | React/FastAPI | High | Keep server-validated moves and partner transfers. |
| Shared annotations and presence | No | Yes | Web | High | Preserve room WebSockets and versioned events. |
| Fairy-Stockfish | Yes | Yes | Combination | High | Keep the tested adapter and bounded async queue. |
| Coaching statistics | Yes | Partial | Local modules | Medium | Migrate as separate API/report slices after the review workspace. |
| Opening Explorer | Yes | No | Local modules | Medium | Add a dedicated web route and view in a later slice. |
| Pattern Academy | Yes | Partial | Combination | Medium | Keep the web puzzle player and expand from local motifs. |
| Multi-board AI prompt | No | Yes | `backend/coach.py` | Medium | Export validated Board A + Board B context to an AI account owned by the user; keep the public app free of shared API keys. |
| Railway deployment | No | Yes | Web | High | Keep Docker, Alembic, static serving and Railway health checks. |

## Migration order

1. Preserve the FastAPI/React deployment and collaboration architecture.
2. Centralize the two-board coaching context in the backend.
3. Add a zero-cost Team Coach workflow using a user-owned AI account.
4. Harden health reporting and engine failure states.
5. Verify the dual-board layout across desktop, tablet and mobile.
6. Migrate Statistics, Opening Explorer and advanced training as independent product views.

## Deliberately retained legacy code

`app.py` is not removed during this migration. It remains the behavioral reference for coaching reports, training queues, Opening Explorer and Pattern Academy until each area has equivalent web tests.
