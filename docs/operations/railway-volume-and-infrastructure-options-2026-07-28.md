# Railway Volume and Infrastructure Options

Date: 2026-07-28

Status: read-only investigation complete; no production data was deleted,
modified, compacted, copied, or migrated.

## Executive recommendation

Use a two-step Railway path:

1. **Immediately have the administrator of `alfaswing's Projects` upgrade that
   workspace to a paid plan and resize the existing volume to 5 GB.** This is
   the fastest and lowest-risk way to restore write headroom. Because the
   volume is already at 100%, Railway may perform an offline resize and briefly
   restart the service.
2. **After a verified backup exists, transfer the intact Railway project to a
   paid workspace Ryan controls.** This is the preferred ownership end state,
   but Ryan cannot initiate it with his current `Can Edit` role. Railway
   requires a project/workspace administrator, and both the source and
   destination must have an active Hobby or Pro subscription.

Do not split the React frontend onto cPanel merely to address this incident; it
does not reduce the Railway data volume and adds cross-origin and WebSocket
complexity. Do not move the full application to shared cPanel hosting: the
current FastAPI service is ASGI, and Namecheap says ASGI applications require a
VPS or dedicated server rather than its shared hosting plans.

## Verified production state

Railway CLI and dashboard checks establish:

| Item | Verified value |
|---|---|
| Project | `thorough-celebration` (`6378186b-cd41-45ef-a72a-606d46c89403`) |
| Workspace | `alfaswing's Projects` |
| Service | `chess-coach-ai` (`3d6ac845-fa28-4af1-9dd9-440a1907d269`) |
| Environment | `production` |
| Volume | `chess-coach-ai-data` (`7108fe72-1242-4425-a6a0-ff2748eb568c`) |
| Mount | `/app/data` |
| Capacity | 500 MB |
| Current use | 498.720768 MB (99.744%; Railway UI reports 100% and “Volume is full”) |
| Persistent game database | `/app/data/bughouse.db` |
| Persistent collaboration database | `/app/data/webapp.db` |
| Active deployment | `f39dba88-ff3c-4e25-a9f6-6140da810756`, `SUCCESS` |
| Ryan's project role | `Can Edit`, not workspace administrator |
| Other Railway data services | None: no PostgreSQL, Redis, bucket, or second volume is attached |

Production variables confirm:

```text
LEGACY_DATABASE_PATH=/app/data/bughouse.db
DATABASE_URL=sqlite:////app/data/webapp.db
RAILWAY_VOLUME_MOUNT_PATH=/app/data
FAIRY_STOCKFISH_PATH=/app/engines/fairy-stockfish
```

Therefore the following do **not** consume the 500 MB persistent-volume quota:

- the Fairy-Stockfish executable at `/app/engines/fairy-stockfish`;
- the React bundle under `/app/frontend/dist`;
- Python packages and application source in the deployed container image;
- the in-memory Chess.com response cache;
- the in-memory analysis-job cache and live room snapshots.

Those items use the service image, ephemeral filesystem, or memory rather than
the mounted `/app/data` volume.

## What is consuming the volume

### Verified consumers

`bughouse.db` stores:

- a `games` table containing the entered username, URL/UUID, player metadata,
  PGN, and the complete imported game payload in `raw_json`;
- engine cache entries;
- mistake and opening analysis;
- analysis-run metadata;
- drills and pattern progress;
- import-run records;
- full-data-discovery reports.

`webapp.db` stores:

- review rooms;
- shared notes;
- chat messages.

The legacy database explicitly enables SQLite WAL mode. Its associated
`bughouse.db-wal` and `bughouse.db-shm` files can therefore also appear in the
volume. A WAL file can grow when checkpoints cannot complete. A live WAL or SHM
file must never be deleted manually.

### Strongest current inference

The primary imported-game database is the likely dominant consumer because it
stores a full JSON payload per `(username, game URL)` and has no global
retention cap. Its uniqueness rule prevents duplicate imports for the same
username and URL, but the same Chess.com game can be stored once for each
different searched username.

A local representative database provides scale context, not a production
measurement:

| Local item | Size/rows |
|---|---:|
| `bughouse.db` | 4,096,000 bytes |
| games | 967 rows |
| games table pages | 3,276,800 bytes |
| engine-cache table and index pages | 507,904 bytes |
| `webapp.db` | 45,056 bytes |

This supports the conclusion that imported game rows are the normal dominant
consumer. It does **not** prove the production table distribution; a large WAL,
old backup, or another file under `/app/data` could account for material usage.

### Evidence gap

The exact production file/table breakdown remains unverified. Railway's current
file and SSH commands require a Railway-registered SSH key, and Ryan has no key
registered. This investigation did not add an authentication credential or
modify account access merely to obtain the listing.

Before cleanup approval, collect:

```bash
du -a -B1 /app/data | sort -n
find /app/data -maxdepth 1 -type f -printf '%f %s bytes\n'
```

For each SQLite database, collect read-only metadata from a copied snapshot:

```sql
PRAGMA page_size;
PRAGMA page_count;
PRAGMA freelist_count;
PRAGMA integrity_check;
SELECT name, SUM(pgsize) AS bytes
FROM dbstat
GROUP BY name
ORDER BY bytes DESC;
```

Do not run a WAL checkpoint, `VACUUM`, delete, truncate, or file rename during
the inventory.

## Safest capacity and cleanup sequence

No destructive cleanup is approved by this report.

### Phase 1 — create headroom without deleting data

1. The `alfaswing's Projects` administrator upgrades the existing workspace to
   Hobby or higher.
2. Resize the existing volume from 500 MB to 5 GB.
3. Expect a brief restart: Railway normally live-resizes paid volumes without
   downtime, but documents that a 100%-full volume can require an offline
   resize and filesystem integrity checks.
4. Verify `/health`, legal pages, callback route, game lookup, room creation,
   and one non-mutating engine-analysis request after the resize.

This is the safest immediate action because it changes capacity rather than
content.

### Phase 2 — establish two recoverable copies

After the resize, and before cleanup:

1. Put the application into a short maintenance window or otherwise stop new
   writes.
2. Create a Railway volume backup.
3. Download a separate, transactionally consistent SQLite backup outside
   Railway; do not copy a live database file without also handling its WAL.
4. Record SHA-256 hashes, timestamps, source deployment, and file sizes.
5. Run `PRAGMA integrity_check` against the downloaded copies.
6. Perform a test restore into an isolated environment and verify application
   reads.

Railway backups cover SQLite volumes, but they can only be restored into the
same project and environment. An external verified copy is therefore required
for a project/provider migration rollback. Railway also limits a manual backup
to 50% of the volume capacity; resizing to 5 GB first gives adequate headroom
for the current approximately 499 MB dataset.

### Phase 3 — inventory and approve exact cleanup targets

Approve targets individually, in this order:

1. **Abandoned temporary or old operator-created backup files.** Remove only
   after file identity, age, and an external verified copy are confirmed.
2. **Recomputable engine cache.** Lowest data-value candidate, but first report
   its exact row count and bytes.
3. **Superseded derived analysis.** Old engine-version analysis, discovery
   reports, or rebuildable aggregates may be candidates after confirming no
   review or puzzle traceability depends on them.
4. **Import-run history.** Usually small; prune only under an approved audit
   retention rule.
5. **Imported game records.** Highest-risk candidate because these are source
   review records. Require an explicit retention rule, dry-run counts, and
   approval by username/date/source before deletion.
6. **Rooms, notes, and chat.** Delete only under the documented deletion
   runbook or an adopted room-retention policy.

### Phase 4 — reclaim filesystem bytes

Deleting SQLite rows makes pages reusable but normally does not shrink the
database file. To return bytes to the volume:

1. stop application writes;
2. create and verify a fresh post-deletion backup;
3. run SQLite integrity checks;
4. checkpoint WAL through SQLite, never by deleting `-wal`/`-shm` files;
5. run `VACUUM` only with sufficient temporary free space and a maintenance
   window;
6. re-run integrity checks and application smoke tests;
7. retain the pre-cleanup external backup until the agreed rollback window
   ends.

Do not attempt `VACUUM` on the current 100%-full 500 MB volume. It can require
substantial temporary disk space and may worsen the outage.

## Infrastructure comparison

| Option | Solves capacity now? | Migration risk | Expected downtime | Required access | Assessment |
|---|---|---|---|---|---|
| 1. Upgrade existing `alfaswing's Projects` workspace | Yes | Low | Normally none for live resize; because this volume is full, expect a brief restart, typically seconds to a few minutes but not guaranteed | `alfaswing's Projects` workspace admin/billing owner, payment method, volume settings | **Immediate recommendation.** Fastest and preserves URLs, variables, service, and volume. Ownership/billing still depends on the existing workspace administrator. |
| 2. Transfer project into a Railway workspace Ryan controls | Yes, once destination is paid and volume limit is adequate | Low to medium | Project transfer should be near-zero interruption, but schedule a maintenance/verification window; exact volume/domain behavior should be verified before acceptance | Source project/workspace admin; Ryan's destination workspace on active Hobby/Pro; Ryan able to accept; verified external backup | **Recommended ownership end state after option 1.** Keeps the architecture intact and puts billing/recovery under Ryan's control. Ryan's current `Can Edit` role cannot initiate the transfer. Railway requires both workspaces to have active Hobby or Pro subscriptions. |
| 3. Move only React frontend to cPanel; backend stays on Railway | No | Medium | Usually a DNS/static cutover of minutes, plus DNS caching; rollback is straightforward if old frontend remains | cPanel/File Manager or SSH, DNS, Railway variables, frontend build/deploy access | **Not recommended for this incident.** The 499 MB databases remain on Railway. Current code assumes same-origin relative API paths and derives WebSocket host from `location.host`; it would need configurable API/WSS origins, CORS changes, deployment coordination, and possibly reverse proxy rules. It also creates two release surfaces. |
| 4. Move full application away from Railway | Yes, if the target has durable storage | High | Plan at least a controlled 15–60 minute write freeze/cutover for this dataset, longer if target setup or restore testing is incomplete | New-host admin/root or PaaS owner; Docker/ASGI/WebSocket support; executable permission for Fairy-Stockfish; persistent storage/database; Railway export; DNS; secrets; CI/CD | **Not recommended now.** It is a legitimate later project, not an emergency cleanup. Shared cPanel is unsuitable for the current ASGI/WebSocket service; use a Docker-capable PaaS, VPS, or dedicated host with automated backups and monitoring. |

## Option-specific risks

### 1. Upgrade the existing Railway workspace

- Lowest technical risk and shortest recovery time.
- The full-volume resize may be offline and restart the service.
- Leaves a governance dependency: Ryan cannot manage workspace billing or
  ownership.
- A paid Hobby plan currently has a $5 monthly minimum/included usage and
  supports up to 5 GB of volume storage. Storage is usage-billed under Railway's
  current pricing.

### 2. Transfer the whole Railway project to Ryan

- Avoids application, database-format, and provider changes.
- Requires cooperation from the existing administrator; Ryan is only `Can
  Edit`.
- Both source and destination need active Hobby or Pro subscriptions.
- Verify after transfer: service variables, GitHub source authorization,
  volume attachment and size, deployment health, Railway domain, custom domain,
  backup schedules, usage limits, and billing alerts.
- Keep an external backup because Railway volume backups cannot be restored
  into a different project/environment.

### 3. Split frontend and backend

Current implementation changes required:

- add build-time `VITE_API_BASE_URL` and `VITE_WS_BASE_URL`;
- replace relative `fetch("/api/...")` calls and `location.host` WebSocket
  construction;
- add `https://thejimmyapp.com` to backend CORS;
- decide whether cPanel proxies `/api`, `/ws`, and puzzle endpoints or the
  browser connects directly to the Railway hostname;
- test secure WebSockets, CSP, cookies/credentials if OAuth later introduces
  them, callback redirects, SPA rewrites, and both legal-page routes.

This option adds failure modes without moving either database, so it does not
improve the immediate storage posture.

### 4. Full provider migration

The destination must support:

- Python 3.12 and FastAPI/ASGI;
- long-lived WebSocket connections;
- a Linux Fairy-Stockfish executable and child processes;
- a persistent filesystem or migrated database;
- controlled secrets and environment variables;
- health checks, TLS, logs, alerts, backups, and tested restores.

Namecheap documents that shared hosting does not support ASGI applications;
VPS or dedicated hosting is required. Running the full stack on a VPS also
transfers OS patching, firewalling, process supervision, backup scheduling,
monitoring, and incident response to the operators.

## Recommended approval gates

No cleanup or migration should proceed until all applicable gates are checked:

- [ ] Workspace administrator and change owner named.
- [ ] Existing volume resized and service healthy.
- [ ] Railway backup completed.
- [ ] External SQLite backup downloaded, hashed, integrity-checked, and test-restored.
- [ ] Exact per-file and per-table production byte inventory attached.
- [ ] Cleanup target, retention basis, dry-run counts, and expected reclaimed bytes approved.
- [ ] Maintenance window and user notice approved.
- [ ] Rollback steps and decision deadline documented.
- [ ] Post-change health, game, room, WebSocket, engine, legal-page, and OAuth-callback tests assigned.

## Source references

- [Railway volumes: file management and resizing](https://docs.railway.com/volumes)
- [Railway volume backups and restore limitations](https://docs.railway.com/volumes/backups)
- [Railway project transfer requirements](https://docs.railway.com/projects)
- [Railway plans and current storage limits](https://docs.railway.com/pricing/plans)
- [Namecheap React/Vite deployment on cPanel](https://www.namecheap.com/support/knowledgebase/article.aspx/10686/29/how-to-deploy-reactjs-vitejs-react-native-and-nextjs-applications-in-cpanel/)
- [Namecheap Python hosting and ASGI limitation](https://www.namecheap.com/support/knowledgebase/article.aspx/10048/2182/how-to-work-with-python-app/)
