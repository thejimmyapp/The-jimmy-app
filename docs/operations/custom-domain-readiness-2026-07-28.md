# Custom Domain Readiness

Date: 2026-07-28

Final status at last verification: **NOT READY**

The Railway production hostname is healthy and hardened. The custom apex domain
is not ready because Railway still reports ownership as unverified and has not
issued a certificate for `thejimmyapp.com`.

## Hobby-upgrade recheck

Rechecked at `2026-07-28T03:38:06Z`.

- Railway's plan page identifies `alfaswing's Projects` as the active workspace
  and says `You're on the Hobby Plan`.
- The production project remains `thorough-celebration`
  (`6378186b-cd41-45ef-a72a-606d46c89403`) in that workspace.
- The production environment remains attached to service `chess-coach-ai`
  (`3d6ac845-fa28-4af1-9dd9-440a1907d269`).
- The Hobby plan is recognized: Railway displays plan limits of 8 vCPU, 8 GB
  memory, and up to 5 GB storage.
- The existing volume did not automatically grow. `chess-coach-ai-data`
  (`7108fe72-1242-4425-a6a0-ff2748eb568c`) is still configured at 500 MB,
  with 498.720768 MB in use, mounted at `/app/data`, and in `Ready` state.
- The volume page exposes a `Live resize` action, but it is disabled for the
  current signed-in user with `Only workspace admins can resize volumes`.
  A workspace admin may resize it within the Hobby plan's 5 GB storage limit.
  No resize was performed.

## 1. DNS action

Namecheap authentication was initially unavailable, then restored during the
work.

The signed-in Namecheap Advanced DNS page already contained the exact required
record:

```text
Type: TXT Record
Host: _railway-verify
Value: railway-verify=d43affd740eedfa6b6d4e12ace1f3966514d0a243b4d7eba9ec956dc5c77d77e
TTL: Automatic
```

No duplicate was added. No CNAME, A, MX, SPF, DKIM, DMARC, mail setting, or
other DNS record was modified.

Namecheap remains authoritative:

```text
dns1.registrar-servers.com
dns2.registrar-servers.com
```

## 2. Public DNS

The required TXT record resolves from the default recursive resolver, directly
from Namecheap's authoritative nameserver, and independently through Cloudflare
(`1.1.1.1`), Google (`8.8.8.8`), and Quad9 (`9.9.9.9`), with a 1,800-second
TTL. A full DNS trace also reaches the correct Namecheap answer.

The apex traffic record also resolves correctly:

```text
thejimmyapp.com CNAME 17drm471.up.railway.app.
```

Railway reports that CNAME as `DNS_RECORD_STATUS_PROPAGATED`.

## 3. Railway ownership and TLS

Railway domain:

```text
Domain ID: 4e8df60a-db18-40b5-bece-d79daec5c129
Domain: thejimmyapp.com
Created: 2026-07-22T15:01:43.570+00:00
Last domain-record update: 2026-07-22T15:01:44.065+00:00
Sync status: ACTIVE
Traffic CNAME: PROPAGATED
Ownership verified: false
Certificate: CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP
```

Railway does not expose a separate validation-attempt timestamp. The two
timestamps above are the domain record's available `createdAt` and `updatedAt`
values.

The Railway UI says `Waiting for DNS update` and shows the same CNAME and TXT
values that are present at Namecheap.

A certificate retry was attempted through Railway's supported command. Railway
refused it because retries become available only after issuance fails; the
current state is still `VALIDATING_OWNERSHIP`.

The certificate currently presented for `thejimmyapp.com` is Railway's
`*.up.railway.app` certificate, whose subject alternative name does not include
the custom domain:

```text
Subject: CN=*.up.railway.app
Issuer: Let's Encrypt YE1
Valid from: 2026-07-03T14:01:30Z
Valid until: 2026-10-01T14:01:29Z
SAN: DNS:*.up.railway.app
```

Standards-valid HTTPS requests therefore fail hostname verification.

## 4. Route verification

### Railway production hostname

`https://jimmyapp-production.up.railway.app`

| Route | Status | Redirects |
|---|---:|---:|
| `/` | 200 | 0 |
| `/privacy` | 200 | 0 |
| `/terms` | 200 | 0 |
| `/health` | 200 | 0 |
| `/api/oauth/chesscom/callback` | 200 | 0 |

The callback response remains:

```json
{
  "status": "pending_authorization",
  "detail": "Chess.com OAuth is not enabled. This callback is reserved for the requested integration."
}
```

The submitted callback is unchanged:

```text
https://jimmyapp-production.up.railway.app/api/oauth/chesscom/callback
```

### Custom apex hostname

Standards-valid HTTPS cannot connect because the certificate does not cover
`thejimmyapp.com`. The `/`, `/privacy`, `/terms`, `/health`, and
`/api/oauth/chesscom/callback` checks all fail with curl exit 60 and HTTP status
000 before an application response is accepted.

With certificate verification deliberately bypassed for diagnosis, all five
routes return Railway's `404 Application not found`, rather than the
application. The latest diagnostic request returned:

```text
HTTP/2 404
x-railway-fallback: true
x-railway-request-id: N1Yi5cCVTmaezAc5jq4OvQ
x-railway-edge: sjc1
Body: {"status":"error","code":404,"message":"Application not found",
       "request_id":"N1Yi5cCVTmaezAc5jq4OvQ"}
```

Plain HTTP reaches Railway's edge at `69.46.46.124` and redirects each tested
route once to the equivalent HTTPS apex URL. This confirms that public DNS
reaches Railway, but Railway has not activated custom-host routing.

There is no redirect loop. The apex does not currently reach the application.

### `www.thejimmyapp.com`

Namecheap contains a `URL Redirect Record`:

```text
Host: www
Destination: https://thejimmyapp.com
Type: Permanent (301)
```

Observed behavior:

- `http://www.thejimmyapp.com/` returns a single 301 to
  `https://thejimmyapp.com/`;
- `https://www.thejimmyapp.com/` times out and does not present a usable TLS
  endpoint;
- public DNS resolves `www` to Namecheap redirect infrastructure at
  `192.64.119.188`.

`www` is therefore partially configured, not a working HTTPS alias. It was not
changed because the authorized DNS task was limited to the Railway ownership
TXT record. Railway also reports that the current plan's custom-domain limit is
already reached.

## 5. Code hardening

Commit: `7914034` (`Harden custom domain boundaries`)

Changed files:

| Path | Change |
|---|---|
| `.env.example` | Documents the canonical public URL, exact submitted callback, allowed CORS origins, trusted hosts, and WebSocket origins. |
| `Dockerfile` | Makes the Vite canonical public origin a configurable build argument with `https://thejimmyapp.com` as its safe production default. |
| `backend/config.py` | Adds exact callback configuration, production CORS origins, trusted hosts, and WebSocket-origin configuration. |
| `backend/main.py` | Adds `TrustedHostMiddleware` and rejects browser WebSockets from unapproved origins with policy code 1008. |
| `tests/test_web_api.py` | Pins the submitted callback and tests trusted hosts, CORS, and allowed/rejected WebSocket origins. |
| `frontend/src/publicUrl.ts` | Creates normalized route-specific canonical URLs using `VITE_PUBLIC_BASE_URL`. |
| `frontend/src/publicUrl.test.ts` | Tests root and Privacy canonical URLs. |
| `frontend/src/vite-env.d.ts` | Adds Vite environment-variable types. |
| `frontend/src/main.tsx` | Installs the canonical link for every rendered route. |

Production variables were set to:

```text
CORS_ORIGINS=https://thejimmyapp.com,https://jimmyapp-production.up.railway.app
TRUSTED_HOSTS=thejimmyapp.com,jimmyapp-production.up.railway.app,*.railway.app,*.railway.internal,localhost,127.0.0.1
WEBSOCKET_ORIGINS=https://thejimmyapp.com,https://jimmyapp-production.up.railway.app
CHESSCOM_OAUTH_CALLBACK_URL=https://jimmyapp-production.up.railway.app/api/oauth/chesscom/callback
VITE_PUBLIC_BASE_URL=https://thejimmyapp.com
```

Legal links remain same-origin relative links (`/privacy` and `/terms`), so they
continue working on the Railway hostname and will work on the custom hostname
after Railway activates it.

No application redirect was added. Railway remains responsible for edge
HTTP-to-HTTPS behavior, avoiding proxy-induced redirect loops.

No cookie-domain setting exists because the application does not currently
have account/authentication cookies.

## 6. Tests and deployment

Local verification:

- Python: **65 passed**, with one existing FastAPI TestClient dependency
  deprecation warning.
- Frontend: **8 files passed, 19 tests passed**.
- ESLint: passed.
- TypeScript/Vite production build: passed.
- `git diff --check`: passed.
- Browser QA:
  - root, Privacy, and Terms render from the production build;
  - canonical URLs are `https://thejimmyapp.com/`,
    `https://thejimmyapp.com/privacy`, and
    `https://thejimmyapp.com/terms`;
  - legal navigation remains same-origin;
  - no browser warnings or errors.

Production deployment:

```text
Deployment: 2979ca95-0610-4185-9092-19a47fa5a6b4
Status: SUCCESS
Image: sha256:36dfca87c52606ffc2d51ac9b74d052d274ed45da7c83d3feb9907990bbea188
```

Production security checks:

- custom-domain CORS preflight: allowed with the exact reflected origin;
- foreign CORS preflight: rejected with HTTP 400 and no allow-origin header;
- Railway-origin WebSocket: connected and received `room.snapshot`;
- foreign-origin WebSocket: rejected with HTTP 403;
- Railway hostname browser: correct canonical and legal links, no console
  warnings/errors.

## 7. Railway support evidence package

The following evidence is sufficient for a Railway support ticket without
changing DNS or recreating the domain:

```text
Workspace:
  alfaswing's Projects
  45877a8e-b027-4e22-947c-37268af17a57
  Active plan shown by Railway: Hobby

Project / environment / service:
  thorough-celebration / production / chess-coach-ai
  6378186b-cd41-45ef-a72a-606d46c89403
  2681f126-78e5-4235-a492-51d345d798c3
  3d6ac845-fa28-4af1-9dd9-440a1907d269

Custom domain:
  thejimmyapp.com
  4e8df60a-db18-40b5-bece-d79daec5c129
  createdAt: 2026-07-22T15:01:43.570+00:00
  updatedAt: 2026-07-22T15:01:44.065+00:00
  syncStatus: ACTIVE
  CNAME status: DNS_RECORD_STATUS_PROPAGATED
  ownership verified: false
  certificate: CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP

Required and observed CNAME:
  thejimmyapp.com CNAME 17drm471.up.railway.app.

Required and observed TXT:
  _railway-verify.thejimmyapp.com
  railway-verify=d43affd740eedfa6b6d4e12ace1f3966514d0a243b4d7eba9ec956dc5c77d77e

Public DNS checks:
  Authoritative dns1.registrar-servers.com: exact TXT and CNAME present
  Authoritative dns2.registrar-servers.com: exact TXT and CNAME present
  Cloudflare 1.1.1.1: exact TXT present
  Google 8.8.8.8: exact TXT present
  Quad9 9.9.9.9: exact TXT present
  Full DNS trace: exact TXT returned by the authoritative server

Edge diagnostics:
  Apex resolves to 69.46.46.124
  HTTP redirects to HTTPS
  TLS presents only DNS:*.up.railway.app
  Insecure diagnostic reaches Railway fallback 404
  Request ID: N1Yi5cCVTmaezAc5jq4OvQ
  Edge: sjc1
```

Requested Railway support action:

> The required ownership TXT and traffic CNAME resolve exactly from both
> authoritative Namecheap nameservers and three independent public resolvers,
> but domain `4e8df60a-db18-40b5-bece-d79daec5c129` remains
> `verification.verified=false` and
> `CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP`. The owning workspace now
> shows an active Hobby plan. Please re-run or repair backend ownership
> validation for the existing domain and issue its certificate without asking
> us to delete and recreate the domain.

## 8. Remaining blockers

1. Railway must recognize the already-propagated ownership TXT record.
2. Railway must issue a certificate containing `thejimmyapp.com`.
3. After issuance, all five apex routes must be repeated with normal certificate
   verification.
4. If `www` is intended to be supported over HTTPS, a separately authorized
   DNS/Railway-domain decision is required. Its current Namecheap redirect works
   only from HTTP.

No billing, project transfer, production-data deletion, SQLite cleanup, or
Chess.com form action was performed. The Namecheap TXT and CNAME records and the
submitted Railway OAuth callback were not modified.
