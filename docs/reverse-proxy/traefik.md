# Traefik

Config lives on Docker labels attached to your containers, so there's no separate config file to maintain. Traefik also handles SSL via Let's Encrypt automatically.

## Prerequisites

A Traefik instance already running on the same Docker network with a `proxy` network defined and a Let's Encrypt certificate resolver named `letsencrypt`. If you don't have that set up yet, check the [Traefik docs](https://doc.traefik.io/traefik/getting-started/quick-start/).

## Labels

Add these labels to the `hub` service in your `docker-compose.yml`:

```yaml
services:
  hub:
    image: lxghtblvee/perch-hub:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.perch.rule=Host(`metrics.example.com`)"
      - "traefik.http.routers.perch.entrypoints=websecure"
      - "traefik.http.routers.perch.tls.certresolver=letsencrypt"
      - "traefik.http.services.perch.loadbalancer.server.port=8484"
    networks:
      - proxy
      - default
    environment:
      PERCH_HUB_TOKEN: ${PERCH_HUB_TOKEN}
      PERCH_DB_HOST: db
      PERCH_DB_USER: perch
      PERCH_DB_PASS: ${PERCH_DB_PASS}
      PERCH_DB_NAME: perch
      PERCH_ADMIN_EMAIL: ${PERCH_ADMIN_EMAIL}
      PERCH_ADMIN_PASSWORD: ${PERCH_ADMIN_PASSWORD}
      PERCH_BASE_URL: https://metrics.example.com
    volumes:
      - hub-uploads:/app/apps/hub/uploads
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

networks:
  proxy:
    external: true
  default:
```

WebSocket upgrades work out of the box with Traefik — no extra config needed.

## Custom domain status pages

If you're using [custom domains on status pages](../features/status-pages.md), add a catch-all router with lower priority alongside the main one:

```yaml
labels:
  - "traefik.enable=true"

  # Primary router — your hub domain
  - "traefik.http.routers.perch.rule=Host(`metrics.example.com`)"
  - "traefik.http.routers.perch.entrypoints=websecure"
  - "traefik.http.routers.perch.tls.certresolver=letsencrypt"
  - "traefik.http.routers.perch.priority=10"
  - "traefik.http.services.perch.loadbalancer.server.port=8484"

  # Catch-all router — custom status page domains
  - "traefik.http.routers.perch-custom.rule=HostRegexp(`{host:.+}`)"
  - "traefik.http.routers.perch-custom.entrypoints=websecure"
  - "traefik.http.routers.perch-custom.tls.certresolver=letsencrypt"
  - "traefik.http.routers.perch-custom.priority=1"
  - "traefik.http.routers.perch-custom.service=perch"
```

The catch-all at priority 1 routes any domain not matched by a higher-priority router to the hub, which serves the correct status page based on the `Host` header.
