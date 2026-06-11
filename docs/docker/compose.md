# Docker Compose

The standard way to run Perch. Three containers — hub, agent, and Postgres managed with two files.

## Prerequisites

- [Docker](https://docs.docker.com/engine/install/) with the Compose plugin (bundled with Docker Desktop and recent Docker Engine installs)

## Setup

Create a `.env` file with your secrets:

```env
PERCH_HUB_TOKEN=          # shared secret between hub and agents — openssl rand -hex 32
PERCH_DB_PASS=            # postgres password
PERCH_ADMIN_EMAIL=        # first admin account email
PERCH_ADMIN_PASSWORD=     # first admin account password
```

Then create a `docker-compose.yml` in the same folder:

```yaml
services:
  hub:
    image: lxghtblvee/perch-hub:latest
    ports:
      - "8484:8484"
    environment:
      PERCH_HUB_TOKEN: ${PERCH_HUB_TOKEN}
      PERCH_DB_HOST: db
      PERCH_DB_USER: perch
      PERCH_DB_PASS: ${PERCH_DB_PASS}
      PERCH_DB_NAME: perch
      PERCH_ADMIN_EMAIL: ${PERCH_ADMIN_EMAIL}
      PERCH_ADMIN_PASSWORD: ${PERCH_ADMIN_PASSWORD}
    volumes:
      - hub-uploads:/app/apps/hub/uploads
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  agent:
    image: lxghtblvee/perch-agent:latest
    environment:
      PERCH_HUB_URL: http://hub:8484
      PERCH_HUB_TOKEN: ${PERCH_HUB_TOKEN}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - agent-data:/data
    depends_on:
      - hub
    restart: unless-stopped

  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: perch
      POSTGRES_PASSWORD: ${PERCH_DB_PASS}
      POSTGRES_DB: perch
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U perch -d perch"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

volumes:
  db-data:
  agent-data:
  hub-uploads:
```

Docker Compose picks up `.env` automatically. Add it to `.gitignore` so secrets don't end up in version control.

## Start Perch

```bash
docker compose up -d
```

The hub waits for Postgres to pass its health check before starting. The dashboard will be at `http://your-server:8484`.

## Monitoring other hosts

The agent in this compose file watches the host it runs on. To watch other machines, run the agent on each of them pointed at your hub's public URL:

```bash
docker run -d \
  --name perch-agent \
  --restart unless-stopped \
  -e PERCH_HUB_URL=https://your-hub-url \
  -e PERCH_HUB_TOKEN=your-secret-token \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v perch-agent-data:/data \
  lxghtblvee/perch-agent:latest
```

## Upgrading

```bash
docker compose pull
docker compose up -d
```

Database migrations run on hub startup automatically.

## Useful commands

```bash
# View logs
docker compose logs -f hub
docker compose logs -f agent

# Restart a service
docker compose restart hub

# Stop everything
docker compose down

# Stop and wipe the database (destructive)
docker compose down -v
```
