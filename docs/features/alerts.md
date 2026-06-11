# Alerts

Perch can notify you when a health check goes down or a container crashes. Alerts work in two steps: add a **destination** (where to send the notification), then create a **rule** (what to watch and when to fire).

## Destinations

A destination is a webhook URL for the service you want notifications sent to. Head to **Alerts** in the sidebar to manage them.

Perch supports three destination types:

### Discord

Paste your Discord webhook URL. Perch sends a rich embed with a colored sidebar (red for down/critical, green for recovery) and shows up as **Perch Alerts** with the Perch icon.

To get a webhook URL in Discord: go to your server settings, open **Integrations > Webhooks**, and create a new webhook in whatever channel you want.

### Slack

Paste your Slack incoming webhook URL. Perch sends a plain message. To get one, go to your Slack workspace's app directory and create an **Incoming Webhooks** app, or use an existing one.

### ntfy

Paste your ntfy topic URL (e.g. `https://ntfy.sh/your-topic`). Works with self-hosted ntfy too. Notifications show up on any device subscribed to that topic.

## Rules

A rule connects a destination to something you want to watch. Rules have no limit, and more than one rule can point at the same destination.

### Health check rules

Fires when a health check transitions between up and down. It won't fire on the first check result, so you don't get spammed when you first create a check.

You'll get a notification when the check goes down, and another when it recovers.

### Container event rules

Fires on two kinds of container events:

- **Crash** — the container transitions from `running` to `stopped` or `dead`
- **Restart** — the container enters a `restarting` state

Pick the agent (host) and container you want to watch, or watch all containers on a host.

## Cooldowns

Each rule has a cooldown period. If an alert fires, it won't fire again for that rule until the cooldown expires. This prevents a flapping check from flooding your notifications.

The cooldown resets after a successful recovery notification, so you'll always hear about a new outage even if you were in cooldown.

## Alert history

The bottom of the Alerts page has a collapsible history table showing recent alerts. Each entry shows the rule, what triggered it, when it fired, and whether the notification went through or failed (e.g. bad webhook URL).

Perch cleans up history based on the retention setting in Instance settings. The default is 30 days.
