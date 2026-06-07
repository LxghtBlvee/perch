import { and, eq, isNull, or } from 'drizzle-orm'
import { db } from '../db'
import { alertRules, alertDestinations, alertHistory } from '../db/schema'

interface AlertContext {
    title: string;
    detail: string;
    fields: { name: string; value: string }[];
    emoji: string;
    color: number;
}

class AlertManager {
    async fireHealthCheckAlert(
        healthCheckId: string,
        healthCheckName: string,
        healthCheckUrl: string,
        status: 'up' | 'down',
    ): Promise<void> {
        const rules = await db
            .select({ rule: alertRules, dest: alertDestinations })
            .from(alertRules)
            .innerJoin(alertDestinations, eq(alertRules.destinationId, alertDestinations.id))
            .where(
                and(
                    eq(alertRules.type, 'health_check'),
                    eq(alertRules.enabled, true),
                    or(eq(alertRules.healthCheckId, healthCheckId), isNull(alertRules.healthCheckId))
                )
            )

            const ctx: AlertContext = {
                title: status === 'down' ? 'Health Check Down' : 'Health Check Recovered',
                detail: `***${healthCheckName}** is ${status === 'down' ? 'DOWN' : 'back UP'}`,
                fields: [
                    { name: 'Check', value: healthCheckName },
                    { name: 'URL', value: healthCheckUrl },
                    { name: 'Status', value: status.toUpperCase() },
                ],
                emoji: status === 'down' ? '⛔' : '✅',
                color: status === 'down' ? 0xff4444 : 0x44d988,
            }

            for (const { rule, dest } of rules) {
                const trigger = rule.onStatus ?? 'both'
                if (trigger !== 'both' && trigger !== status) continue;
                if (!this.cooldownOk(rule.lastFiredAt, rule.cooldown)) continue
                await this.dispatch(rule.id, dest, ctx);
            }
    }

    async fireContainerAlert(
        agentId: string,
        agentHostname: string,
        containerName: string,
        containerImage: string,
        event: 'crash' | 'restart'
    ): Promise<void> {
        const rules = await db
            .select({ rule: alertRules, dest: alertDestinations })
            .from(alertRules)
            .innerJoin(alertDestinations, eq(alertRules.destinationId, alertDestinations.id))
            .where(
                and(
                    eq(alertRules.type, 'container_event'),
                    eq(alertRules.enabled, true),
                    or(eq(alertRules.agentId, agentId), isNull(alertRules.agentId))
                )
            )

            const ctx: AlertContext = {
                title: event === 'crash' ? 'Container Crashed' : 'Container Restarting',
                detail: `**${containerName}** ${event === 'crash' ? 'crashed unexpectedly' : 'is restarting'} on **${agentHostname}**`,
                fields: [
                    { name: 'Container', value: containerName },
                    { name: 'Host', value: agentHostname },
                    { name: 'Image', value: containerImage },
                    { name: 'Event', value: event === 'crash' ? 'Crash' : 'Restart' },
                ],
                emoji: event === 'crash' ? '💥' : '🔄',
                color: event === 'crash' ? 0xff4444 : 0xffaa00,
            }

            for (const { rule, dest } of rules) {
                const events: string[] = rule.events ? (JSON.parse(rule.events) as string[]) : ['crash']
                if (!events.includes(event)) continue
                if (!this.cooldownOk(rule.lastFiredAt, rule.cooldown)) continue
                await this.dispatch(rule.id, dest, ctx)
            }
    }

    async testDestination(destinationId: string): Promise<void> {
    const [dest] = await db
      .select()
      .from(alertDestinations)
      .where(eq(alertDestinations.id, destinationId))
    if (!dest) throw new Error('Destination not found')

    const ctx: AlertContext = {
      title: 'Test Alert',
      detail: 'This is a test notification from **Perch**. Everything is wired up correctly.',
      fields: [
        { name: 'Source', value: 'Perch' },
        { name: 'Type', value: 'Test' },
      ],
      emoji: '🧪',
      color: 0x7dd3c0,
    }

    await this.send(dest, ctx)
  }

  private cooldownOk(lastFiredAt: Date | null, cooldownSeconds: number): boolean {
    if (!lastFiredAt) return true
    return Date.now() - new Date(lastFiredAt).getTime() >= cooldownSeconds * 1000
  }

  private async dispatch(
    ruleId: string,
    dest: typeof alertDestinations.$inferSelect,
    ctx: AlertContext
  ): Promise<void> {
    let status: 'sent' | 'failed' = 'sent'
    let error: string | undefined

    try {
      await this.send(dest, ctx)
    } catch (err) {
      status = 'failed'
      error = err instanceof Error ? err.message : String(err)
      console.warn(`[alerts] dispatch failed for rule ${ruleId}: ${error}`)
    }

    await Promise.all([
      db
        .update(alertRules)
        .set({ lastFiredAt: new Date(), updatedAt: new Date() })
        .where(eq(alertRules.id, ruleId)),
      db.insert(alertHistory).values({ ruleId, detail: ctx.detail, status, error }),
    ])
  }

  private async send(dest: typeof alertDestinations.$inferSelect, ctx: AlertContext): Promise<void> {
    if (dest.type === 'discord') return this.sendDiscord(dest.webhookUrl, ctx)
    if (dest.type === 'slack') return this.sendSlack(dest.webhookUrl, ctx)
    if (dest.type === 'ntfy')
      return this.sendNtfy(dest.webhookUrl, dest.ntfyTopic ?? 'perch', dest.ntfyPriority ?? 'default', ctx)
  }

  private async sendDiscord(webhookUrl: string, ctx: AlertContext): Promise<void> {
    const body = {
      username: 'Perch Alerts',
      avatar_url: 'https://www.image2url.com/r2/default/images/1780870008952-2162faba-7883-43c0-827e-7465ee4179fa.png',
      embeds: [
        {
          title: `${ctx.emoji} ${ctx.title}`,
          description: ctx.detail.replace(/\*\*/g, '**'),
          color: ctx.color,
          fields: ctx.fields.map((f) => ({ name: f.name, value: f.value, inline: true })),
          timestamp: new Date().toISOString(),
          footer: { text: 'Perch' },
        },
      ],
    }
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Discord returned ${res.status}`)
  }

  private async sendSlack(webhookUrl: string, ctx: AlertContext): Promise<void> {
    const body = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${ctx.emoji} *${ctx.title}*\n${ctx.detail.replace(/\*\*/g, '*')}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: ctx.fields.map((f) => `*${f.name}:* ${f.value}`).join('  •  '),
            },
          ],
        },
      ],
    }
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Slack returned ${res.status}`)
  }

  private async sendNtfy(
    baseUrl: string,
    topic: string,
    priority: string,
    ctx: AlertContext
  ): Promise<void> {
    const priorityMap: Record<string, number> = {
      min: 1,
      low: 2,
      default: 3,
      high: 4,
      urgent: 5,
    }
    const cleanBase = baseUrl.replace(/\/$/, '')
    const res = await fetch(`${cleanBase}/${topic}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${ctx.emoji} ${ctx.title}`,
        message: ctx.detail.replace(/\*\*/g, ''),
        priority: priorityMap[priority] ?? 3,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`ntfy returned ${res.status}`)
  }
}

export const alertManager = new AlertManager();