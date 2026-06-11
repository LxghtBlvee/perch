# Perch Docs

Welcome to the Perch documentation. These docs are for people deploying and using Perch — if you're looking to contribute to the codebase, check the main [README](../README.md).

## Setup

- [Getting Started](./setup/getting-started.md) — install Perch with Docker Compose, first login, adding agents
- [Configuration](./setup/configuration.md) — all environment variables for the hub and agent

## Features

- [Health Checks](./features/health-checks.md) — monitor HTTP endpoints, track uptime and latency
- [Alerts](./features/alerts.md) — get notified on Discord, Slack, or ntfy when things go down
- [Status Pages](./features/status-pages.md) — public-facing status pages with custom domains and theming
- [Data Sources](./features/data-sources.md) — connect Prometheus, Loki, InfluxDB, and Graphite

## Auth & Users

- [SSO / OAuth](./auth/sso.md) — set up GitHub, Google, Microsoft, GitLab, Discord, Okta, or a custom OIDC provider
- [User Management](./auth/users.md) — roles, account recovery, and managing who has access
