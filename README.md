<p align="center">
  <img src="./public/assets/perch-lockup-teal.svg" alt="Perch" width="620" />
</p>

<p align="center">
  Unified self-hosted monitoring for servers, Docker containers, and Kubernetes clusters.
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-7dd3c0?style=flat-square" /></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" /></a>
  <a href="https://bun.sh"><img alt="Bun" src="https://img.shields.io/badge/Bun-runtime-fbf0df?style=flat-square&logo=bun&logoColor=000000" /></a>
  <a href="https://hub.docker.com/u/lxghtblvee"><img alt="Docker Hub" src="https://img.shields.io/badge/Docker_Hub-lxghtblvee-2496ED?style=flat-square&logo=docker&logoColor=white" /></a>
</p>

---

Perch is a lightweight, self-hosted monitoring dashboard that pulls server metrics, container stats, log visibility, and HTTP health checks into one place. If you're tired of running Dozzle, Beszel, and Uptime Kuma side-by-side, Perch is the one tab that covers everything.

A lightweight agent runs on each host and connects out to a central hub, which serves the dashboard and streams live updates to your browser over WebSocket for fast connections.

## Features

- **Server metrics:** CPU, memory, disk, network, load average, and uptime across all your hosts
- **Docker monitoring:** container stats, status, resource usage, and a live log viewer
- **Health checks:** HTTP endpoint monitoring with uptime history, latency tracking, and heartbeat visualization
- **Alerting:** rules for health check transitions and container events, with Discord, Slack, and ntfy support
- **Status pages:** public-facing status pages with custom domains, theming, and drag-sort check assignment
- **SSO / OAuth:** GitHub, Google, Microsoft, GitLab, Discord, Okta, and custom OIDC providers
- **Data sources:** connect Prometheus, Loki, InfluxDB, and Graphite
- **User management:** admin and member roles, account recovery, and last-login tracking
- **Live dashboard:** real-time WebSocket updates with no polling

## Stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Backend | [Elysia](https://elysiajs.com) |
| Frontend | [Vue 3](https://vuejs.org) + [Vite](https://vite.dev) + [Tailwind v4](https://tailwindcss.com) |
| Database | PostgreSQL via [Drizzle ORM](https://orm.drizzle.team) |
| Deployment | Docker / [Docker Hub](https://hub.docker.com/u/lxghtblvee) |

## Docs

Full documentation for deployment, configuration, reverse proxy setup, SSO, and everything else lives at **[perch.lxghtblvee.dev/docs](https://perch.lxghtblvee.dev/docs)**.

## Development

**Prerequisites:** [Bun](https://bun.sh), Docker (for the database)

```bash
git clone https://github.com/LxghtBlvee/perch.git
cd perch
bun install

# Start everything with Docker (hub, agent, db)
docker compose up -d

# Or run hub and web dev servers separately
bun dev:hub
bun dev:web
```

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for the dev setup, project layout, and PR workflow. Found a security issue? Please follow the [security policy](./SECURITY.md) rather than opening a public issue.
