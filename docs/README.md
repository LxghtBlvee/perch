# Perch Docs

Welcome to the Perch documentation. These docs are for people deploying and using Perch. If you're looking to contribute to the codebase, check the main [README](../README.md).

## Getting Started

- [Overview](./setup/getting-started.md) — what Perch is and how to pick a deployment method
- [Configuration](./setup/configuration.md) — all environment variables for the hub and agent

## Deployment

- [Docker Compose](./docker/compose.md) — single host, the standard setup
- [Docker Swarm](./docker/swarm.md) — multi-node clusters
- [Portainer](./docker/portainer.md) — deploy and manage from a GUI

## Features

- [Health Checks](./features/health-checks.md) — track uptime and latency on your HTTP endpoints
- [Alerts](./features/alerts.md) — get notified on Discord, Slack, or ntfy when things go down
- [Status Pages](./features/status-pages.md) — public-facing status pages with custom domains and theming
- [Data Sources](./features/data-sources.md) — connect Prometheus, Loki, InfluxDB, and Graphite

## Auth & Users

- [SSO / OAuth](./auth/sso.md) — set up GitHub, Google, Microsoft, GitLab, Discord, Okta, or a custom OIDC provider
- [User Management](./auth/users.md) — roles, account recovery, and managing who has access
