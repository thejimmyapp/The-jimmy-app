# Custom Domain Readiness

Date: 2026-07-28

Final status at last verification: **NOT READY**

The Railway production hostname is healthy and hardened. The custom apex domain
is not ready because Railway still reports ownership as unverified and has not
issued a certificate for `thejimmyapp.com`.

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
Sync status: ACTIVE
Traffic CNAME: PROPAGATED
Ownership verified: false
Certificate: CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP
```

The Railway UI says `Waiting for DNS update` and shows the same CNAME and TXT
values that are present at Namecheap.

A certificate retry was attempted through Railway's supported command. Railway
refused it because retries become available only after issuance fails; the
current state is still `VALIDATING_OWNERSHIP`.

The certificate currently presented for `thejimmyapp.com` is Railway's
`*.up.railway.app` certificate, whose subject alternative name does not include
the custom domain. Standards-valid HTTPS requests therefore fail hostname
verification.

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
`thejimmyapp.com`.

With certificate verification deliberately bypassed for diagnosis, all five
routes return Railway's `404 Application not found`, rather than the
application. This confirms that Railway has not activated custom-host routing.

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

## 7. Remaining blockers

1. Railway must recognize the already-propagated ownership TXT record.
2. Railway must issue a certificate containing `thejimmyapp.com`.
3. After issuance, all five apex routes must be repeated with normal certificate
   verification.
4. If `www` is intended to be supported over HTTPS, a separately authorized
   DNS/Railway-domain decision is required. Its current Namecheap redirect works
   only from HTTP.

No billing, project transfer, production-data deletion, SQLite cleanup, or
Chess.com form action was performed.
