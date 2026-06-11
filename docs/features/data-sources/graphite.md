# Graphite

Connect a Graphite instance to Perch to query its metrics alongside your other data sources.

## Adding a connection

Go to **Data Sources** in the sidebar and click **Add Data Source**. Select **Graphite** and fill in:

- **Name** — a label for this connection (e.g. "Production Graphite")
- **URL** — the base URL of your Graphite web app (e.g. `http://graphite:80`)
- **Basic auth** — username and password if your Graphite install requires authentication

## URL format

Point Perch at the Graphite web application URL, not the Carbon receiver port. Graphite's web app typically runs on port 80 or 8080:

```
http://graphite:80
http://graphite:8080
https://graphite.example.com
```

If Graphite is on the same Docker host, use the container name rather than `localhost`.
