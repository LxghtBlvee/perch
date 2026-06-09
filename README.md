<p align="center">
  <img src="./public/assets/perch-lockup-teal.svg" alt="Perch" width="620" />
</p>

<p align="center">
  Unified self-hosted monitoring for servers, Docker containers, and Kubernetes clusters.
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-7dd3c0?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Bun" src="https://img.shields.io/badge/Bun-runtime-fbf0df?style=flat-square&logo=bun&logoColor=000000" />
  <img alt="Docker Hub" src="https://img.shields.io/badge/Docker_Hub-lxghtblvee-2496ED?style=flat-square&logo=docker&logoColor=white" />
</p>

---

## What is Perch?

Perch is a lightweight, self-hosted monitoring dashboard that brings server metrics, container stats, log visibility, and HTTP health checks into one place. It is designed for homelabbers and self-hosters who want something more unified than running Dozzle, Beszel, and Uptime Kuma side-by-side.

It uses an agent-based architecture — a lightweight agent runs on each monitored host and connects out to a central hub, which serves the dashboard and streams live updates to the browser over WebSocket.

## Features

- **Server metrics:** CPU, memory, disk, network, load average, and uptime across all your hosts
- **Docker monitoring:** container stats, status, resource usage, and live log viewer
- **Health checks:** HTTP endpoint monitoring with uptime history, latency tracking, and heartbeat visualization
- **Alerting:** rules for health check transitions and container events, with Discord, Slack, and ntfy destinations
- **Status pages:** public-facing status pages with custom domains, theming, and drag-sort check assignment
- **SSO / OAuth:** GitHub, Google, Microsoft, GitLab, Discord, Okta, and custom OIDC providers
- **Data sources:** connect Prometheus, Loki, InfluxDB, and Graphite
- **User management:** admin and member roles, account recovery, last-login tracking
- **Live dashboard:** real-time WebSocket updates with no polling
- **Agent-based:** agents connect out to the hub — no inbound firewall rules needed on monitored hosts

## Stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Backend | [Elysia](https://elysiajs.com) |
| Frontend | [Vue 3](https://vuejs.org) + [Vite](https://vite.dev) + [Tailwind v4](https://tailwindcss.com) |
| Database | PostgreSQL via [Drizzle ORM](https://orm.drizzle.team) |
| Deployment | Docker / [Docker Hub](https://hub.docker.com/u/lxghtblvee) |

## Getting Started

Copy the following into a `docker-compose.yml` and fill in your secrets:

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

Then run:

```bash
docker compose up -d
```

The dashboard will be available at `http://localhost:8484`. Log in with the `PERCH_ADMIN_EMAIL` and `PERCH_ADMIN_PASSWORD` you set above.

To monitor additional hosts, run the agent service on each one pointed at your hub's public URL.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PERCH_HUB_TOKEN` | — | Shared secret between hub and agents (required) |
| `PERCH_DB_HOST` | — | PostgreSQL host |
| `PERCH_DB_USER` | `perch` | PostgreSQL user |
| `PERCH_DB_PASS` | — | PostgreSQL password (required) |
| `PERCH_DB_NAME` | `perch` | PostgreSQL database |
| `PERCH_ADMIN_EMAIL` | — | Seeds the first admin user on startup |
| `PERCH_ADMIN_PASSWORD` | — | Seeds the first admin user on startup |
| `PERCH_SESSION_DAYS` | `30` | Session expiry in days |
| `PERCH_PORT` | `8484` | Port the hub listens on |

## Development

**Prerequisites:** [Bun](https://bun.sh), Docker (for the database)

```bash
# Clone and install
git clone https://github.com/LxghtBlvee/perch.git
cd perch
bun install

# Start everything with Docker (hub, agent, db)
docker compose up --build

# Or run hub and web dev servers separately
bun dev:hub
bun dev:web
```

## License

[AGPL-3.0](./LICENSE)
