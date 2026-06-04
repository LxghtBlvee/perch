<p align="center">
  <img src="./public/assets/perch-lockup-teal.svg" alt="Perch" width="620" />
</p>

<p align="center">
  Unified self-hosted monitoring for servers, Docker containers, and Kubernetes clusters.
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/github/license/LxghtBlvee/perch?style=flat-square&color=7dd3c0" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-blue?style=flat-square" />
  <img alt="Bun" src="https://img.shields.io/badge/Bun-runtime-black?style=flat-square" />
</p>

---

## What is Perch?

Perch is a lightweight, self-hosted monitoring dashboard that brings server metrics, container stats, log visibility, and HTTP health checks into one place. It is designed for homelabbers and self-hosters who want something more unified than running Dozzle, Beszel, and Uptime Kuma side-by-side.

It ships as a single Docker image, persists data in Postgres, and streams live updates to the browser over WebSocket.

## Features

- **Server metrics:** CPU, memory, disk, network, load average, uptime
- **Docker and Kubernetes:** container stats, status, and logs across all your hosts
- **Health checks:** HTTP endpoint monitoring with uptime history and latency tracking
- **Live dashboard:** real-time WebSocket updates, no polling
- **Agent-based:** lightweight agents connect out to the hub, no inbound firewall rules needed
- **Self-contained:** one `docker compose up` and you are running

## Stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Backend | [Elysia](https://elysiajs.com) |
| Frontend | [Vue 3](https://vuejs.org) + [Vite](https://vite.dev) |
| Database | PostgreSQL via [Drizzle ORM](https://orm.drizzle.team) |
| Deployment | Docker / GHCR |

## Getting Started

Add the following to your `docker-compose.yml`:

```yaml
services:
  perch:
    image: ghcr.io/lxghtblvee/perch:latest
    ports:
      - "8484:8484"
    environment:
      PERCH_HUB_TOKEN: your-secret-token
      PERCH_DB_HOST: db
      PERCH_DB_USER: perch
      PERCH_DB_PASS: your-db-password
      PERCH_DB_NAME: perch
    depends_on:
      - db

  db:
    image: postgres:17
    environment:
      POSTGRES_USER: perch
      POSTGRES_PASSWORD: your-db-password
      POSTGRES_DB: perch
    volumes:
      - perch-db:/var/lib/postgresql/data

volumes:
  perch-db:
```

Then run:

```bash
docker compose up -d
```

The dashboard will be available at `http://localhost:8484`.

## Development

**Prerequisites:** [Bun](https://bun.sh), PostgreSQL

```bash
# Clone and install
git clone https://github.com/LxghtBlvee/perch.git
cd perch
bun install

# Configure environment
cp apps/hub/.env.example apps/hub/.env
# Edit apps/hub/.env with your values

# Push the database schema
bun --cwd apps/hub db:push

# Start the hub and web dev servers
bun dev:hub
bun dev:web
```

## License

[MIT](./LICENSE)
