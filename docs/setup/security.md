# Security

This page covers the security controls built into Perch and what to check before running a production deployment.

## CORS

Perch locks CORS to a single allowed origin derived from `PERCH_BASE_URL`. Set it to your public URL:

```
PERCH_BASE_URL=https://metrics.example.com
```

Without this variable set, Perch falls back to a CORS wildcard in non-production environments. In production you should treat `PERCH_BASE_URL` as required. See [Configuration](./configuration.md) for the full variable reference.

## Login lockout

Perch rate-limits password login attempts to protect against brute-force attacks. After a configurable number of failed attempts within 15 minutes, the account gets locked out and further attempts return HTTP 429.

The lockout threshold and whether it's enabled at all are configurable from **Admin > Instance > Sessions & Security**. The default is 5 attempts before lockout. See [Instance Settings](./instance-settings.md) for details.

## SSRF protection

Health checks and data source connections let you point Perch at a URL. To prevent the hub from probing your internal network, Perch checks every URL before making a request:

- Hostnames that resolve to localhost, RFC 1918 addresses (10.x, 172.16–31.x, 192.168.x), or link-local addresses get rejected.
- The check runs in two stages: a string-based hostname rejection first, then a DNS lookup to catch public hostnames that resolve to private IPs (DNS rebinding).

If a URL fails this check, Perch returns an error and does not make the request.

## Agent authentication

Agents connect to the hub over WebSocket and authenticate with `PERCH_HUB_TOKEN`. The hub gives each new agent connection 5 seconds to send a valid auth message. Connections that don't authenticate in time get closed with an `auth_error` message.

Use a long random string for the token:

```bash
openssl rand -hex 32
```

Never share it with anyone who doesn't need to run an agent.

## Session security

Session tokens are opaque random strings hashed with SHA-256 before storage. The raw token goes to the client once and never gets stored in plaintext. OAuth callbacks and account recovery links use short-lived single-use handoff codes rather than embedding session tokens in URLs. The client exchanges the code for a token right after redirect, so the token never appears in server logs, browser history, or Referer headers.

Session expiry is configurable. See [Instance Settings](./instance-settings.md).

## Security headers

Perch adds the following headers to every response:

- `Content-Security-Policy` — restricts resource loading to trusted sources
- `X-Frame-Options: DENY` — prevents the dashboard from loading inside an iframe
- `X-Content-Type-Options: nosniff` — stops browsers from sniffing response content types
- `Permissions-Policy` — disables browser features the dashboard doesn't use

No configuration needed.

## Maintenance mode

If you need to take your instance down for an upgrade, turn on maintenance mode from **Admin > Instance**. Non-admin users can't log in while it's enabled. Admins keep full access. See [Instance Settings](./instance-settings.md).
