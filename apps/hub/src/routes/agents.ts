import Elysia, { t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { agents } from '../db/schema'
import { agentRegistry } from '../services/agent-registry'
import { liveRegistry } from '../services/live-registry'
import { requireAuthUser } from '../middleware/auth'

export const agentRoutes = new Elysia({ prefix: '/api/agents' })
  .get('/', async ({ request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    return agentRegistry.getAll()
  })
  .get('/:id', async ({ params, request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    const entry = agentRegistry.get(params.id)
    if (!entry) { set.status = 404; return { message: 'Agent not found' } }
    return entry
  })
  .get('/:id/metrics', async ({ params, request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    const entry = agentRegistry.get(params.id)
    if (!entry) { set.status = 404; return { message: 'Agent not found' } }
    return entry.metrics
  })
  .get('/:id/containers', async ({ params, request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    const entry = agentRegistry.get(params.id)
    if (!entry) { set.status = 404; return { message: 'Agent not found' } }
    return entry.containers
  })
  .patch('/:id', async ({ params, body, request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }

    const [updated] = await db
      .update(agents)
      .set({ displayName: body.displayName ?? null })
      .where(eq(agents.id, params.id))
      .returning()
    if (!updated) { set.status = 404; return { error: 'Agent not found' } }

    agentRegistry.updateDisplayName(params.id, updated.displayName)
    liveRegistry.broadcast({ type: 'agent_updated', agentId: params.id, displayName: updated.displayName })

    return updated
  }, {
    body: t.Object({ displayName: t.Union([t.String(), t.Null()]) }),
  })

  .delete('/:id', async ({ params, request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }

    await db.delete(agents).where(eq(agents.id, params.id))
    agentRegistry.unregister(params.id)
    liveRegistry.broadcast({ type: 'agent_disconnected', agentId: params.id })

    return { success: true }
  })

  .get('/:id/containers/:containerId/logs', async ({ params, query, request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    const entry = agentRegistry.get(params.id)
    if (!entry) { set.status = 404; return { message: 'Agent not found' } }
    try {
      const tail = Number(query.tail ?? 200)
      const logs = await agentRegistry.requestLogs(params.id, params.containerId, tail)
      return { logs }
    } catch (e: unknown) {
      set.status = 502
      return { error: e instanceof Error ? e.message : 'Failed to fetch logs' }
    }
  })