# Perch Docs

These docs cover everything you need to deploy, configure, and use Perch. If you want to contribute to the codebase instead, head to the [main README](../README.md).

## What's in here

**Getting set up**
Start with the [overview](./setup/getting-started.md) if you're new, then check the [configuration reference](./setup/configuration.md) for a full list of environment variables.

**Deploying**
Perch runs on Docker. Pick whichever method fits your setup:
[Docker Compose](./docker/compose.md) for a single host, [Docker Swarm](./docker/swarm.md) for multi-node clusters, or [Portainer](./docker/portainer.md) if you prefer a GUI.

**Reverse proxy**
Put Perch behind [nginx](./reverse-proxy/nginx.md), [Traefik](./reverse-proxy/traefik.md), or [Caddy](./reverse-proxy/caddy.md).

**Features**
- [Health Checks](./features/health-checks.md) — track uptime and latency on HTTP endpoints
- [Alerts](./features/alerts.md) — get notified on Discord, Slack, or ntfy
- [Status Pages](./features/status-pages.md) — public pages with custom domains and themes
- Data Sources: [Prometheus](./features/data-sources/prometheus.md), [Loki](./features/data-sources/loki.md), [InfluxDB](./features/data-sources/influxdb.md), [Graphite](./features/data-sources/graphite.md)

**Auth and users**
[User management](./auth/users.md) covers roles and account recovery. For SSO, pick your provider:
[GitHub](./auth/sso/github.md), [Google](./auth/sso/google.md), [Microsoft](./auth/sso/microsoft.md), [GitLab](./auth/sso/gitlab.md), [Discord](./auth/sso/discord.md), [Okta](./auth/sso/okta.md), or self-hosted with [Authentik](./auth/sso/custom/authentik.md), [Keycloak](./auth/sso/custom/keycloak.md), [Authelia](./auth/sso/custom/authelia.md), [Dex](./auth/sso/custom/dex.md), or [any other OIDC provider](./auth/sso/custom/README.md).
