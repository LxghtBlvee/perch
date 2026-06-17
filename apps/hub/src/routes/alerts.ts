import Elysia, { t } from 'elysia'
import { desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { alertDestinations, alertRules, alertHistory } from '../db/schema'
import { alertManager } from '../services/alert-manager'
import { requireAuthUser, requireAdminUser } from '../middleware/auth'
import { isSafeUrl } from '../lib/safe-url'

/** Redacts the secret token in a webhook URL for non-admin viewers. */
function maskWebhookUrl(url: string): string {
  try { return `${new URL(url).origin}/•••` } catch { return '•••' }
}

export const alertRoutes = new Elysia({ prefix: '/api/alerts' })

  .get('/destinations', async ({ request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    const rows = await db.select().from(alertDestinations).orderBy(alertDestinations.createdAt)
    // Webhook URLs are credentials — only admins (who can edit) see them in full.
    if (user.role === 'admin') return rows
    return rows.map(d => ({ ...d, webhookUrl: maskWebhookUrl(d.webhookUrl) }))
  })

  .post('/destinations', async ({ body, request, set }) => {
    const user = await requireAdminUser(request, set)
    if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }
    if (!await isSafeUrl(body.webhookUrl)) { set.status = 400; return { error: 'Webhook URL must be a publicly accessible http/https address' } }
    const [dest] = await db.insert(alertDestinations).values({
      name: body.name,
      type: body.type,
      webhookUrl: body.webhookUrl,
      ntfyTopic: body.ntfyTopic ?? null,
      ntfyPriority: body.ntfyPriority ?? 'default',
    }).returning()
    return dest
  }, {
    body: t.Object({
      name: t.String(),
      type: t.Union([t.Literal('discord'), t.Literal('slack'), t.Literal('ntfy')]),
      webhookUrl: t.String(),
      ntfyTopic: t.Optional(t.String()),
      ntfyPriority: t.Optional(t.String()),
    }),
  })

  .put('/destinations/:id', async ({ params, body, request, set }) => {
    const user = await requireAdminUser(request, set)
    if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }
    if (body.webhookUrl !== undefined && !await isSafeUrl(body.webhookUrl)) { set.status = 400; return { error: 'Webhook URL must be a publicly accessible http/https address' } }
    const [dest] = await db
      .update(alertDestinations)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(alertDestinations.id, params.id))
      .returning()
    return dest
  }, {
    body: t.Partial(t.Object({
      name: t.String(),
      type: t.Union([t.Literal('discord'), t.Literal('slack'), t.Literal('ntfy')]),
      webhookUrl: t.String(),
      ntfyTopic: t.String(),
      ntfyPriority: t.String(),
    })),
  })

  .delete('/destinations/:id', async ({ params, request, set }) => {
    const user = await requireAdminUser(request, set)
    if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }
    await db.delete(alertDestinations).where(eq(alertDestinations.id, params.id))
    return { success: true }
  })

  .post('/destinations/:id/test', async ({ params, request, set }) => {
    const user = await requireAdminUser(request, set)
    if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }
    try {
      await alertManager.testDestination(params.id)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  .get('/rules', async ({ request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    const rows = await db
      .select({ rule: alertRules, destination: alertDestinations })
      .from(alertRules)
      .innerJoin(alertDestinations, eq(alertRules.destinationId, alertDestinations.id))
      .orderBy(alertRules.createdAt)

    return rows.map(({ rule, destination }) => ({
      ...rule,
      events: rule.events ? JSON.parse(rule.events) : null,
      destination,
    }))
  })

  .post('/rules', async ({ body, request, set }) => {
    const user = await requireAdminUser(request, set)
    if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }
    const [rule] = await db.insert(alertRules).values({
      name: body.name,
      type: body.type,
      healthCheckId: body.healthCheckId ?? null,
      onStatus: body.onStatus ?? null,
      agentId: body.agentId ?? null,
      events: body.events ? JSON.stringify(body.events) : null,
      cooldown: body.cooldown ?? 300,
      destinationId: body.destinationId,
    }).returning()
    return { ...rule, events: rule.events ? JSON.parse(rule.events) : null }
  }, {
    body: t.Object({
      name: t.String(),
      type: t.Union([t.Literal('health_check'), t.Literal('container_event')]),
      destinationId: t.String(),
      cooldown: t.Optional(t.Number()),
      healthCheckId: t.Optional(t.String()),
      onStatus: t.Optional(t.Union([t.Literal('down'), t.Literal('up'), t.Literal('both')])),
      agentId: t.Optional(t.String()),
      events: t.Optional(t.Array(t.Union([t.Literal('crash'), t.Literal('restart')]))),
    }),
  })

  .put('/rules/:id', async ({ params, body, request, set }) => {
    const user = await requireAdminUser(request, set)
    if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }
    const [rule] = await db
      .update(alertRules)
      .set({
        ...body,
        events: body.events ? JSON.stringify(body.events) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(alertRules.id, params.id))
      .returning()
    return { ...rule, events: rule.events ? JSON.parse(rule.events) : null }
  }, {
    body: t.Partial(t.Object({
      name: t.String(),
      destinationId: t.String(),
      cooldown: t.Number(),
      healthCheckId: t.String(),
      onStatus: t.Union([t.Literal('down'), t.Literal('up'), t.Literal('both')]),
      agentId: t.String(),
      events: t.Array(t.Union([t.Literal('crash'), t.Literal('restart')])),
    })),
  })

  .patch('/rules/:id/toggle', async ({ params, request, set }) => {
    const user = await requireAdminUser(request, set)
    if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }
    const [current] = await db.select().from(alertRules).where(eq(alertRules.id, params.id))
    if (!current) { set.status = 404; return { error: 'Not found' } }
    const [rule] = await db
      .update(alertRules)
      .set({ enabled: !current.enabled, updatedAt: new Date() })
      .where(eq(alertRules.id, params.id))
      .returning()
    return { ...rule, events: rule.events ? JSON.parse(rule.events) : null }
  })

  .delete('/rules/:id', async ({ params, request, set }) => {
    const user = await requireAdminUser(request, set)
    if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }
    await db.delete(alertRules).where(eq(alertRules.id, params.id))
    return { success: true }
  })

  .get('/history', async ({ query, request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    const limit = Math.min(Number(query.limit ?? 50), 200)
    const offset = Number(query.offset ?? 0)
    return db
      .select()
      .from(alertHistory)
      .orderBy(desc(alertHistory.triggeredAt))
      .limit(limit)
      .offset(offset)
  })
