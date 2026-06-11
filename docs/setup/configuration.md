# Configuration Reference

The hub and agent take all their config from environment variables.

## Hub

| Variable | Required | Default | Description |
|---|---|---|---|
| `PERCH_HUB_TOKEN` | Yes | | Shared secret that agents use to authenticate. Must match on every agent. |
| `PERCH_DB_HOST` | Yes | | Postgres hostname (`db` when using the bundled Compose setup) |
| `PERCH_DB_PORT` | | `5432` | Postgres port |
| `PERCH_DB_USER` | | `perch` | Postgres username |
| `PERCH_DB_PASS` | Yes | | Postgres password |
| `PERCH_DB_NAME` | | `perch` | Postgres database name |
| `PERCH_ADMIN_EMAIL` | | | Seeds the first admin account on startup, when no users exist yet |
| `PERCH_ADMIN_PASSWORD` | | | Password for the seeded admin account |
| `PERCH_SESSION_DAYS` | | `30` | How long login sessions last before expiring, in days |
| `PERCH_PORT` | | `8484` | Port the hub listens on |
| `PERCH_BASE_URL` | | | Your public URL (e.g. `https://metrics.example.com`). Set this when running behind a reverse proxy so OAuth callback URLs come out right. |
| `PERCH_VERSION` | | | Override the version string shown on the Instance page (e.g. `v1.2.0`). If not set, Perch fetches the latest tag from Docker Hub. |

## Agent

| Variable | Required | Default | Description |
|---|---|---|---|
| `PERCH_HUB_URL` | Yes | | URL of your hub (e.g. `http://hub:8484` or `https://metrics.example.com`). The agent connects to this over WebSocket. |
| `PERCH_HUB_TOKEN` | Yes | | Must match `PERCH_HUB_TOKEN` on the hub. |
| `PERCH_INTERVAL` | | `5000` | How often the agent pushes metrics, in milliseconds. |
| `PERCH_AGENT_ID_FILE` | | `/data/agent.id` | Where the agent stores its persistent ID. Mount a volume here so it keeps the same identity across restarts. |

## Notes

### PERCH_HUB_TOKEN

This is the shared secret between the hub and all agents. It has nothing to do with user logins — it lets the hub tell which WebSocket connections are legitimate agents vs. noise.

Make it a long random string:

```bash
openssl rand -hex 32
```

### PERCH_ADMIN_EMAIL / PERCH_ADMIN_PASSWORD

These seed the first admin account when the database is empty. After that first startup, they have no effect. If you need to change the admin password later, do it from the Settings page or use account recovery.

### PERCH_BASE_URL

Set this when running behind a reverse proxy. Without it, Perch infers the base URL from the incoming request's `Host` header, which can produce wrong OAuth callback URLs when proxied.

No trailing slash:

```
PERCH_BASE_URL=https://metrics.example.com
```
