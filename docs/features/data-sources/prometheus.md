# Prometheus

Connect a Prometheus instance to Perch so you can query it alongside your other metrics.

## Adding a connection

Go to **Data Sources** in the sidebar and click **Add Data Source**. Select **Prometheus** and fill in:

- **Name** — a label for this connection (e.g. "Production Prometheus")
- **URL** — the base URL of your Prometheus instance (e.g. `http://prometheus:9090`)
- **Basic auth** — username and password if your Prometheus requires authentication

Save it and Perch will store the connection.

## URL format

Use the base URL without a trailing slash — Perch appends the API paths itself:

```
http://prometheus:9090
https://prometheus.example.com
```

If Prometheus is running on the same Docker host as the hub, use the container name or `host.docker.internal` rather than `localhost`. `localhost` inside the hub container refers to the hub, not the host.

## Authentication

If your Prometheus is behind a reverse proxy with basic auth, fill in the username and password fields. For Bearer token auth or more advanced setups, consider putting Prometheus behind a proxy that handles auth before it reaches the hub.
