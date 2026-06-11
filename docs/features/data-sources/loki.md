# Loki

Connect a Grafana Loki instance to Perch to query logs alongside your metrics.

## Adding a connection

Go to **Data Sources** in the sidebar and click **Add Data Source**. Select **Loki** and fill in:

- **Name** — a label for this connection (e.g. "Production Loki")
- **URL** — the base URL of your Loki instance (e.g. `http://loki:3100`)
- **Basic auth** — username and password if your Loki requires authentication

## URL format

Use the base URL without a trailing slash:

```
http://loki:3100
https://loki.example.com
```

If Loki is on the same Docker host, use the container name instead of `localhost` — `localhost` inside the hub container refers to the hub itself.

## Grafana Cloud Loki

If you're using Grafana Cloud, your Loki URL looks like:

```
https://logs-prod-xxx.grafana.net
```

You'll find it in your Grafana Cloud stack settings. Use your Grafana Cloud username and an API token with logs read permissions for the basic auth fields.
