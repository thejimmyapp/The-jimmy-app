# Manual data-deletion runbook

Owner: designated operator for `hello@thejimmyapp.com`

Applies to: imported games, analysis/training records, review rooms, shared notes, and room chat

Execution model: verified request, dry run, backup, explicit execution, verification

## 1. Receive and record the request

1. Create an internal request ID. Do not put passwords, cookies, tokens, or full
   PGNs in the ticket.
2. Record the requested Chess.com username, source-game IDs/URLs, and/or Jimmy
   App review-room IDs.
3. Acknowledge receipt from `hello@thejimmyapp.com`.

## 2. Verify the requester and scope

The app has no user accounts or OAuth today, so email address alone does not
prove control of a Chess.com username.

- For username-wide deletion, send a one-time nonce and ask the requester to
  place it temporarily in the public profile for that Chess.com username.
  Verify it through the public profile, record that verification occurred, and
  ask the requester to remove the nonce.
- For a specific review room, possession of the full unguessable room URL plus
  a matching room ID is sufficient to delete that room's collaboration data.
- For a specific game, match the supplied Chess.com source URL or numeric local
  game ID during the dry run. If identity or scope is ambiguous, ask for the
  exact URL/ID rather than deleting a broader username.

Never request a Chess.com password, cookie, CSRF token, copied cURL command, or
reusable session credential.

## 3. Preview

Run from the deployed application environment so the configured database paths
and URL point to the production stores:

```bash
python scripts/delete_stored_data.py \
  --username verified_username \
  --request-id DELETE-YYYY-NNN
```

The default mode is dry-run. Review the counts and matched game/room IDs. The
command does not print PGNs, chat contents, or database credentials.

Selectors can be narrowed or combined:

```bash
python scripts/delete_stored_data.py \
  --game-id 123 \
  --room-id 00000000-0000-0000-0000-000000000000 \
  --request-id DELETE-YYYY-NNN
```

## 4. Back up and execute

1. Confirm the request ID, verification record, selectors, and dry-run counts.
2. Take a database/volume backup or snapshot and record its expiry date. Restrict
   access to the designated operator.
3. Re-run the exact preview command with `--execute`.

```bash
python scripts/delete_stored_data.py \
  --username verified_username \
  --request-id DELETE-YYYY-NNN \
  --execute
```

Execution removes matching imported games, discovery data, mistakes, analysis
runs, training attempts/progress, related review rooms, notes, and chat. Because
engine-cache entries are position-derived and not attributable to one person,
the tool clears the shared recomputable engine cache whenever personal records
are deleted.

## 5. Verify and close

1. Run the same command again without `--execute`.
2. Confirm all requested personal-data counts are zero. A nonzero global engine
   cache count after normal app use is not evidence that the person's source
   data remains; the cache can immediately repopulate from other completed
   games.
3. Record only the request ID, date, operator, selectors, verification method,
   before/after counts, and backup-expiry date.
4. Confirm completion to the requester from `hello@thejimmyapp.com`.
5. Delete the backup when its documented expiry date is reached.

## Operational prerequisites

- A named person must monitor `hello@thejimmyapp.com`.
- That operator must have access to the Railway application environment and
  both configured data stores.
- Railway storage must have enough free space to create a safe snapshot, or the
  operator must use Railway's supported external backup/export path.
- This runbook is a manual process; the app does not currently offer a
  self-service deletion dashboard or guaranteed automatic retention period.
