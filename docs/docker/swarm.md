# Docker Swarm

If you're running a multi-node Docker Swarm cluster, you can deploy Perch as a stack. The agent runs in `global` mode so every node in the cluster gets one automatically.

## Prerequisites

- A Docker Swarm cluster with at least one manager node
- `docker stack` available (comes with Docker Engine)

## Secrets

Swarm lets you store sensitive values as secrets rather than plain environment variables. This is optional but worth doing for anything running in production.

Create secrets from the manager node:

```bash
echo "your-secret-token" | docker secret create perch_hub_token -
echo "your-db-password" | docker secret create perch_db_pass -
echo "your-admin-password" | docker secret create perch_admin_password -
```

## The stack file

Save this as `perch-stack.yml`:

```yaml
version: '3.8'

services:
  hub:
    image: lxghtblvee/perch-hub:latest
    ports:
      - "8484:8484"
    environment:
      PERCH_DB_HOST: db
      PERCH_DB_USER: perch
      PERCH_DB_NAME: perch
      PERCH_ADMIN_EMAIL: admin@example.com
      PERCH_HUB_TOKEN_FILE: /run/secrets/perch_hub_token
      PERCH_DB_PASS_FILE: /run/secrets/perch_db_pass
      PERCH_ADMIN_PASSWORD_FILE: /run/secrets/perch_admin_password
    secrets:
      - perch_hub_token
      - perch_db_pass
      - perch_admin_password
    volumes:
      - hub-uploads:/app/apps/hub/uploads
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      restart_policy:
        condition: on-failure
    networks:
      - perch

  agent:
    image: lxghtblvee/perch-agent:latest
    environment:
      PERCH_HUB_URL: http://hub:8484
      PERCH_HUB_TOKEN_FILE: /run/secrets/perch_hub_token
    secrets:
      - perch_hub_token
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - agent-data:/data
    deploy:
      mode: global
      restart_policy:
        condition: on-failure
    networks:
      - perch

  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: perch
      POSTGRES_DB: perch
      POSTGRES_PASSWORD_FILE: /run/secrets/perch_db_pass
    secrets:
      - perch_db_pass
    volumes:
      - db-data:/var/lib/postgresql/data
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      restart_policy:
        condition: on-failure
    networks:
      - perch

volumes:
  db-data:
  agent-data:
  hub-uploads:

networks:
  perch:
    driver: overlay

secrets:
  perch_hub_token:
    external: true
  perch_db_pass:
    external: true
  perch_admin_password:
    external: true
```

> **Note:** If you'd rather skip Docker secrets, replace the `*_FILE` env vars with plain values (e.g. `PERCH_HUB_TOKEN: your-token`) and remove the `secrets` sections.

## Deploy the stack

From your manager node:

```bash
docker stack deploy -c perch-stack.yml perch
```

## Check the status

```bash
# List services
docker stack services perch

# View logs for the hub
docker service logs perch_hub -f

# View logs for the agent (all nodes)
docker service logs perch_agent -f
```

## A note on startup order

Unlike Docker Compose, Swarm doesn't support `depends_on` with health checks. The hub may try to connect to Postgres before it's ready and crash-loop a couple of times before succeeding. That's expected — Swarm will restart it and it'll come up once the database is ready.

## Upgrading

```bash
docker service update --image lxghtblvee/perch-hub:latest perch_hub
docker service update --image lxghtblvee/perch-agent:latest perch_agent
```

Or pull new images and redeploy the whole stack:

```bash
docker stack deploy -c perch-stack.yml perch
```

## Remove the stack

```bash
docker stack rm perch
```

This removes the services but leaves volumes intact. To wipe the data too:

```bash
docker volume rm perch_db-data perch_hub-uploads perch_agent-data
```
