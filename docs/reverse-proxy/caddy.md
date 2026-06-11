# Caddy

The easiest option. Caddy handles HTTPS and certificate renewal automatically with no extra config, and WebSocket proxying works without any special headers.

## Caddyfile

```caddy
metrics.example.com {
    reverse_proxy localhost:8484
}
```

That's it. Caddy gets a certificate from Let's Encrypt on first request and renews it automatically.

## Set PERCH_BASE_URL

Add `PERCH_BASE_URL` to your `.env` so OAuth callbacks work:

```env
PERCH_BASE_URL=https://metrics.example.com
```

Then restart the hub:

```bash
docker compose restart hub
```

## Custom domain status pages

If you're using [custom domains on status pages](../features/status-pages.md), add a block for each custom domain pointing at the same backend:

```caddy
metrics.example.com {
    reverse_proxy localhost:8484
}

status.yourservice.com {
    reverse_proxy localhost:8484
}
```

Caddy handles the certificate for each domain automatically.

## Running Caddy with Docker

If Caddy is running in Docker on the same host, use the container name instead of `localhost`:

```caddy
metrics.example.com {
    reverse_proxy hub:8484
}
```

And make sure Caddy and the hub are on the same Docker network.
