import Elysia, { t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { agents } from '../db/schema'
import { agentRegistry } from '../services/agent-registry'
import { liveRegistry } from '../services/live-registry'
import { requireAuthUser, requireAdminUser } from '../middleware/auth'

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
    const user = await requireAdminUser(request, set)
    if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }

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
    const user = await requireAdminUser(request, set)
    if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }

    const [deleted] = await db.delete(agents).where(eq(agents.id, params.id)).returning()
    agentRegistry.unregister(params.id)
    liveRegistry.broadcast({ type: 'agent_disconnected', agentId: params.id })

    if (!deleted) { set.status = 404; return { error: 'Agent not found' } }
    return { success: true }
  })

  .get('/:id/containers/:containerId/logs', async ({ params, query, request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    // Container IDs are Docker hashes (hex). Reject anything else: the agent
    // interpolates this value into a Docker Engine API path, so characters like
    // '/', '?' or '..' would allow path-injection into other API endpoints
    // (e.g. /containers/<id>/json, which leaks env vars/secrets).
    if (!/^[a-f0-9]{12,64}$/.test(params.containerId)) {
      set.status = 400; return { error: 'Invalid container ID' }
    }
    const entry = agentRegistry.get(params.id)
    if (!entry) { set.status = 404; return { message: 'Agent not found' } }
    try {
      const tail = Math.min(Math.max(Math.trunc(Number(query.tail)) || 200, 1), 1000)
      const logs = await agentRegistry.requestLogs(params.id, params.containerId, tail)
      return { logs }
    } catch (e: unknown) {
      set.status = 502
      return { error: e instanceof Error ? e.message : 'Failed to fetch logs' }
    }
  })