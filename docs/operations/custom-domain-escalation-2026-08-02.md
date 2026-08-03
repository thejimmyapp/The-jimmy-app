# Custom domain escalation — August 2, 2026

## User impact

The application is healthy at `https://jimmyapp-production.up.railway.app`, but
`https://thejimmyapp.com` is not currently a valid public entrypoint. A normal
TLS client rejects the hostname because Railway serves a certificate for
`*.up.railway.app`. An insecure probe reaches Railway but returns HTTP 404.

## Verified state

- Railway project: `6378186b-cd41-45ef-a72a-606d46c89403`
- Service: `TheJimmyapp` (`3d6ac845-fa28-4af1-9dd9-440a1907d269`)
- Environment: `production` (`2681f126-78e5-4235-a492-51d345d798c3`)
- Domain: `thejimmyapp.com` (`4e8df60a-db18-40b5-bece-d79daec5c129`)
- Domain target port: `8080`
- Railway sync status: `ACTIVE`
- Railway certificate status: `CERTIFICATE_STATUS_TYPE_ISSUING`
- Railway verification state: `false`
- The domain has remained in this state since it was created on July 22, 2026.

Public DNS is correct and propagated:

- Apex CNAME: `thejimmyapp.com -> 17drm471.up.railway.app`
- Railway verification TXT: present at `_railway-verify.thejimmyapp.com`
- Authoritative DNS: `dns1.registrar-servers.com` and `dns2.registrar-servers.com`
- No restrictive CAA record was found.

The certificate currently presented has subject and SANs only for
`*.up.railway.app` and `up.railway.app`. It is valid from July 29 through
October 27, 2026, but not for `thejimmyapp.com`.

## Safe actions already attempted

`railway domain certificate retry thejimmyapp.com` was attempted after the DNS
recheck. Railway refused the retry because retries are allowed only after an
issuance reaches a failed state; the domain is still stuck in `ISSUING`.

No DNS record, domain attachment, or production service setting was changed.
Deleting and recreating the domain was deliberately avoided because it can
change the required DNS target and create additional downtime.

## Railway support request draft

> Custom domain `thejimmyapp.com` (domain ID
> `4e8df60a-db18-40b5-bece-d79daec5c129`) has remained in
> `CERTIFICATE_STATUS_TYPE_ISSUING` with `verification.verified=false` since
> July 22. Both the required apex CNAME and `_railway-verify` TXT record are
> publicly propagated, and no restrictive CAA record exists. The service is
> healthy on its Railway hostname, but the custom hostname receives the
> `*.up.railway.app` certificate and an insecure request returns 404. The CLI
> refuses `domain certificate retry` because the issuance is not marked
> failed. Please reset the verification/certificate issuance state for this
> existing domain without changing its DNS target, or identify the specific
> verification check that is failing.

Attach the output of these read-only commands if support asks for evidence:

```text
railway domain status thejimmyapp.com --service TheJimmyapp --environment production --json
dig +short CNAME thejimmyapp.com
dig +short TXT _railway-verify.thejimmyapp.com
openssl s_client -connect thejimmyapp.com:443 -servername thejimmyapp.com </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```
