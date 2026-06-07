import Elysia, { t } from 'elysia'
import { desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { alertDestinations, alertRules, alertHistory } from '../db/schema'
import { alertManager } from '../services/alert-manager'

export const alertRoutes = new Elysia({ prefix: '/api/alerts' })

  .get('/destinations', () =>
    db.select().from(alertDestinations).orderBy(alertDestinations.createdAt)
  )

  .post('/destinations', async ({ body }) => {
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

  .put('/destinations/:id', async ({ params, body }) => {
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

  .delete('/destinations/:id', async ({ params }) => {
    await db.delete(alertDestinations).where(eq(alertDestinations.id, params.id))
    return { success: true }
  })

  .post('/destinations/:id/test', async ({ params }) => {
    try {
      await alertManager.testDestination(params.id)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  .get('/rules', async () => {
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

  .post('/rules', async ({ body }) => {
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

  .put('/rules/:id', async ({ params, body }) => {
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

  .patch('/rules/:id/toggle', async ({ params, set }) => {
    const [current] = await db.select().from(alertRules).where(eq(alertRules.id, params.id))
    if (!current) { set.status = 404; return { error: 'Not found' } }
    const [rule] = await db
      .update(alertRules)
      .set({ enabled: !current.enabled, updatedAt: new Date() })
      .where(eq(alertRules.id, params.id))
      .returning()
    return { ...rule, events: rule.events ? JSON.parse(rule.events) : null }
  })

  .delete('/rules/:id', async ({ params }) => {
    await db.delete(alertRules).where(eq(alertRules.id, params.id))
    return { success: true }
  })

  .get('/history', async ({ query }) => {
    const limit = Math.min(Number(query.limit ?? 50), 200)
    const offset = Number(query.offset ?? 0)
    return db
      .select()
      .from(alertHistory)
      .orderBy(desc(alertHistory.triggeredAt))
      .limit(limit)
      .offset(offset)
  })