# Instance Settings

The Instance page (`Admin > Instance`) is where you configure how your Perch deployment behaves. Changes take effect after hitting **Save changes** and apply to all users on the instance.

## General

The General section displays deployment info you cannot edit here: the hub token (tap the eye to reveal it) and the current version. The hub token comes from the `PERCH_HUB_TOKEN` environment variable. You cannot change it from the UI. The **Sign-in methods** card links to the Auth page where you configure OAuth providers.

## Sessions & Security

**Session expiry** — the number of days a login session lasts before the user has to sign in again. Default is 30 days. Lower this if you want tighter control over access, for shared or high-security environments.

**Self-registration** — when enabled, anyone can create an account by visiting the login page and signing up, or by signing in with an OAuth provider for the first time. When disabled, admins must create accounts. You can set the default role for self-registered accounts to either `member` or `admin`.

**Login lockout** — blocks a user from attempting to log in after failed password attempts within 15 minutes. The threshold controls the number of failures that trigger the lockout. Defaults to enabled with a threshold of 5 attempts. See [Security](./security.md) for more details.

## Agents & Monitoring

**Report interval** — how often agents push metrics to the hub, in milliseconds. Default is 5000ms (every 5 seconds). Lower values give you fresher data but increase traffic between agents and the hub.

**Reconnect delay** — how long an agent waits before trying to reconnect after a dropped WebSocket connection, in milliseconds. Default is 5000ms.

**Default check interval** — the default cadence for new health checks, in seconds. Default is 60 seconds. You can override this per health check. Lowering this instance-wide means new checks run more often by default.

**Default check timeout** — how long the hub waits for an HTTP response before marking a health check as timed out, in milliseconds. Default is 10000ms (10 seconds). Increase this for endpoints with slow response times.

## Alerts

**Webhook timeout** — how long the hub waits for a webhook delivery to Discord, Slack, or ntfy before giving up and logging it as failed. Default is 10000ms.

**Default cooldown** — the cooldown applied to new alert rules at creation time, in seconds. Default is 300 seconds (5 minutes). A cooldown prevents the same rule from firing again in a short window, which cuts down on notification noise.

## Privacy

**Geolocation** — when enabled, Perch makes a request to `ipapi.co` on startup to fetch the hub's city and country. This shows up on the Overview page as the hub's location. Disable this if you don't want your hub making outbound requests to a third-party IP lookup service.

## Retention

Perch runs a cleanup job once an hour and trims old records based on these settings.

**Metrics history** — the number of days of agent metrics to keep. Default is 30 days.

**Alert history** — the number of days of fired alert records to keep in the history table. Default is 90 days.

**Health check results** — the number of days of ping results to keep. Default is 90 days. The health check detail page draws its charts and heartbeat bars from this data, so trimming too aggressively will shorten the visible history.

## Maintenance

**Maintenance mode** — when enabled, non-admin users cannot log in. They see an error on the login page. Admins can still sign in. Use this during upgrades or when you need to take the instance down temporarily without cutting off admin access.

Turn it off when you're done. It's a toggle, not a timed window.

## Monitored Platforms

Perch ships with agent support for Docker, Kubernetes, Podman, Proxmox, Nomad, and LXC/LXD. Toggle on the platforms you use. Perch shows the enabled platforms in the UI and tells agents which integrations to activate.

## Status Pages

Toggle this on to enable public-facing status pages at `/status/:slug`. When disabled, the Status Pages admin section does not appear and existing pages stop serving. See [Status Pages](../features/status-pages.md) for setup.
