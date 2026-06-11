# Perch Docs

Welcome to the Perch documentation. These docs are for people deploying and using Perch. If you're looking to contribute to the codebase, check the main [README](../README.md).

## Getting Started

- [Overview](./setup/getting-started.md) — what Perch is and how to pick a deployment method
- [Configuration](./setup/configuration.md) — all environment variables for the hub and agent

## Deployment

- [Docker Compose](./docker/compose.md) — single host, the standard setup
- [Docker Swarm](./docker/swarm.md) — multi-node clusters
- [Portainer](./docker/portainer.md) — deploy and manage from a GUI

## Reverse Proxy

- [nginx](./reverse-proxy/nginx.md)
- [Traefik](./reverse-proxy/traefik.md)
- [Caddy](./reverse-proxy/caddy.md)

## Features

- [Health Checks](./features/health-checks.md) — track uptime and latency on your HTTP endpoints
- [Alerts](./features/alerts.md) — get notified on Discord, Slack, or ntfy when things go down
- [Status Pages](./features/status-pages.md) — public-facing status pages with custom domains and theming
- Data Sources — connect external metric and log stores
  - [Prometheus](./features/data-sources/prometheus.md)
  - [Loki](./features/data-sources/loki.md)
  - [InfluxDB](./features/data-sources/influxdb.md)
  - [Graphite](./features/data-sources/graphite.md)

## Auth & Users

- [User Management](./auth/users.md) — roles, account recovery, and managing who has access
- SSO / OAuth — sign in with an external provider
  - [GitHub](./auth/sso/github.md)
  - [Google](./auth/sso/google.md)
  - [Microsoft](./auth/sso/microsoft.md)
  - [GitLab](./auth/sso/gitlab.md)
  - [Discord](./auth/sso/discord.md)
  - [Okta](./auth/sso/okta.md)
  - [Custom OIDC](./auth/sso/custom.md)
