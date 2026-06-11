# Portainer

If you manage your Docker host through [Portainer](https://www.portainer.io), you can deploy Perch as a stack directly from the Portainer UI.

## Deploy as a stack

1. Open Portainer and go to your environment
2. Click **Stacks** in the left sidebar
3. Click **Add stack**
4. Give it a name (e.g. `perch`)
5. Select **Web editor** and paste in the compose YAML below
6. Scroll down to **Environment variables** and fill in your secrets there (recommended — keeps them out of the stack definition)
7. Click **Deploy the stack**

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

Fill in these variables in the **Environment variables** section at the bottom of the stack editor before deploying:

| Variable | Value |
|---|---|
| `PERCH_HUB_TOKEN` | A long random string — `openssl rand -hex 32` |
| `PERCH_DB_PASS` | A strong database password |
| `PERCH_ADMIN_EMAIL` | Your admin account email |
| `PERCH_ADMIN_PASSWORD` | Your admin account password |

## Upgrading

1. Go to **Stacks** and open the `perch` stack
2. Click **Pull and redeploy**

Portainer pulls the latest images and restarts the services. Database migrations run on hub startup automatically.

## Monitoring other hosts

To watch other machines from Portainer, you have two options:

**Option 1 — Add the host to Portainer as an environment**, then deploy the agent service there as its own stack:

```yaml
services:
  agent:
    image: lxghtblvee/perch-agent:latest
    environment:
      PERCH_HUB_URL: https://your-hub-url
      PERCH_HUB_TOKEN: your-secret-token
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - agent-data:/data
    restart: unless-stopped

volumes:
  agent-data:
```

**Option 2 — SSH into the other host** and run the agent with `docker run` or a minimal compose file. See [Docker Compose](./compose.md) for the command.
