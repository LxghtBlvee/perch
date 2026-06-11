# Health Checks

Health checks let you point Perch at any HTTP or HTTPS endpoint and track whether it's up, how fast it responds, and how reliable it's been over time. Think of it like a lightweight Uptime Kuma built into your dashboard.

## Creating a health check

Go to **Health Checks** in the sidebar and hit **New Check**. You'll need:

- **Name** — what to call it in the dashboard (e.g. "API", "Homepage", "Auth Service")
- **URL** — the endpoint to check. Must be reachable from the machine running the hub.
- **Interval** — how often to run the check, in seconds. 60 seconds is a solid default.
- **Expected status** — the HTTP status code that counts as "up". Defaults to `200`. Set this to `301` or `302` if you're checking a redirect, for example.

Hit **Save** and the check starts running.

## What the dashboard shows

Each check gets a card on the Health Checks page with:

- **Status dot** — green pulsing when up, red when down
- **Uptime %** — calculated over the last 90 results
- **Avg latency** — average response time across recent checks
- **Heartbeat bars** — a row of 90 colored slots representing the last 90 results, newest on the right. Green is up, red is down, grey is pending or no data yet.

Click a check to open the detail page, which has a full response time chart and a paginated results table showing what happened and when.

## How checks fire

The first check runs as soon as you save, not after the first interval. If you set a 60-second interval, you'll have your first result within a couple of seconds of creating the check.

After that, checks run on the interval you set. Each result stores the timestamp, HTTP status, response time in milliseconds, and whether it counted as up or down.

## What counts as "up"

A check counts as up when the response status matches your configured expected status. Anything else is down. Network errors (timeout, connection refused, DNS failure) always count as down.

## Alerts on health checks

If you want to get notified when a check goes down or comes back up, set up an alert rule pointing at it. See [Alerts](./alerts.md) for how to wire that up.

## A note on what Perch can reach

Health checks run from the hub container, not your browser. The URLs need to be reachable from wherever the hub is running. Checking `http://localhost:3000` from the hub will hit the hub's own localhost, not yours. If you want to check something on your local network, make sure the hub can route to it.

The same goes for private services: if your hub is on a VPS and you want to check an internal service, you'd need to either expose it or run the check from an agent on the same network. (Agent-side health checks aren't a thing yet, but that's on the roadmap.)
