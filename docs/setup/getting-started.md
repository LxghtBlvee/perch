# Getting Started

Perch runs as three Docker containers: the hub (dashboard + API), an agent (collects metrics on the host it runs on), and a Postgres database.

Pick your deployment method:

- [Docker Compose](../docker/compose.md) — the standard way, works on any single host
- [Docker Swarm](../docker/swarm.md) — for multi-node clusters
- [Portainer](../docker/portainer.md) — if you prefer a GUI

## After deploying

Once Perch is running, head to `http://your-server:8484` and sign in with the admin email and password you set during setup.

You'll land on the Overview page. The agent running alongside the hub will already be reporting. From here:

- Add more agents on other hosts to expand coverage — each one shows up in the dashboard within seconds of connecting
- Set up [health checks](../features/health-checks.md) to track your HTTP endpoints
- Configure [alerts](../features/alerts.md) so you hear about outages
- Create a [status page](../features/status-pages.md) to share uptime publicly
- Set up [SSO](../auth/sso/README.md) so your team can sign in without a separate password

## Upgrading

Regardless of deployment method, upgrading Perch means pulling new images and restarting. Database migrations run on hub startup automatically, so there's nothing extra to do.

See the upgrade section in your deployment guide for the exact commands.
