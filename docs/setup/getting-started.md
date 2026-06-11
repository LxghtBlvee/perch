# Getting Started

Perch runs as three Docker containers: the hub (dashboard + API), an agent (collects metrics on the host it runs on), and a Postgres database. The quickest way to get going is with Docker Compose.

## What you need

- A server with [Docker](https://docs.docker.com/engine/install/) and Docker Compose installed
- A domain or IP that your agents can reach the hub at, if you plan to watch more than one machine

## Deploy with Docker Compose

Create a `docker-compose.yml` on your server and fill in your own values:

```yaml
services:
  hub:
    image: lxghtblvee/perch-hub:latest
    ports:
      - "8484:8484"
    environment:
      PERCH_HUB_TOKEN: your-secret-token
      PERCH_DB_HOST: db
      PERCH_DB_USER: perch
      PERCH_DB_PASS: your-db-password
      PERCH_DB_NAME: perch
      PERCH_ADMIN_EMAIL: admin@example.com
      PERCH_ADMIN_PASSWORD: your-admin-password
    volumes:
      - hub-uploads:/app/apps/hub/uploads
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  agent:
    image: lxghtblvee/perch-agent:latest
    environment:
      PERCH_HUB_URL: http://hub:8484
      PERCH_HUB_TOKEN: your-secret-token
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - agent-data:/data
    depends_on:
      - hub
    restart: unless-stopped

  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: perch
      POSTGRES_PASSWORD: your-db-password
      POSTGRES_DB: perch
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U perch -d perch"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

volumes:
  db-data:
  agent-data:
  hub-uploads:
```

> `PERCH_HUB_TOKEN` is the shared secret between the hub and all your agents. Make it something strong: `openssl rand -hex 32` works great.

Start everything:

```bash
docker compose up -d
```

The dashboard will be at `http://your-server:8484`. Sign in with the email and password you set above.

## First login

Perch creates an admin account from `PERCH_ADMIN_EMAIL` and `PERCH_ADMIN_PASSWORD` on first startup, when the database is empty. After that, those env vars do nothing — manage accounts from the **Admin > Users** page instead.

Once you're in, you'll see the Overview page with the agent already reporting from the host running the hub.

## Monitoring other hosts

Each host you want to watch needs its own agent. Agents connect **out** to the hub over WebSocket, so you don't need to open any inbound ports on the machines you're monitoring.

On each host, run:

```bash
docker run -d \
  --name perch-agent \
  --restart unless-stopped \
  -e PERCH_HUB_URL=https://your-hub-url:8484 \
  -e PERCH_HUB_TOKEN=your-secret-token \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v perch-agent-data:/data \
  lxghtblvee/perch-agent:latest
```

Or drop it into a `docker-compose.yml` on that machine:

```yaml
services:
  agent:
    image: lxghtblvee/perch-agent:latest
    environment:
      PERCH_HUB_URL: https://your-hub-url:8484
      PERCH_HUB_TOKEN: your-secret-token
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - agent-data:/data
    restart: unless-stopped

volumes:
  agent-data:
```

The agent shows up in the dashboard within seconds of connecting.

> The `/var/run/docker.sock` mount is optional. Drop it if you want and the agent will still report server metrics (CPU, memory, disk, network) — you won't get container visibility.

## Behind a reverse proxy

If Perch is behind nginx, Traefik, Caddy, or anything else, set `PERCH_BASE_URL` to your public URL. Perch uses this for OAuth callback URLs:

```yaml
environment:
  PERCH_BASE_URL: https://metrics.example.com
```

Perch uses a WebSocket at `/ws/live` for live updates. Make sure your proxy passes WebSocket upgrades through. For nginx, add these to your location block:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

## Upgrading

```bash
docker compose pull
docker compose up -d
```

Database migrations run automatically on hub startup, so there's nothing extra to do.

## What's next

- [Configuration reference](./configuration.md) — every env var for the hub and agent
- [Health checks](../features/health-checks.md) — track uptime and latency on your HTTP endpoints
- [Alerts](../features/alerts.md) — get notified on Discord, Slack, or ntfy
- [Status pages](../features/status-pages.md) — share uptime with your users
- [SSO / OAuth](../auth/sso.md) — let your team sign in with GitHub, Google, and more
