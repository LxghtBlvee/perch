import Elysia from 'elysia'
import { agentRegistry } from '../services/agent-registry'

export const agentRoutes = new Elysia({ prefix: '/api/agents' })
  .get('/', () => agentRegistry.getAll())
  .get('/:id', ({ params, set }) => {
    const entry = agentRegistry.get(params.id)
    if (!entry) { set.status = 404; return { message: 'Agent not found' } }
    return entry
  })
  .get('/:id/metrics', ({ params, set }) => {
    const entry = agentRegistry.get(params.id)
    if (!entry) { set.status = 404; return { message: 'Agent not found' } }
    return entry.metrics
  })
  .get('/:id/containers', ({ params, set }) => {
    const entry = agentRegistry.get(params.id)
    if (!entry) { set.status = 404; return { message: 'Agent not found' } }
    return entry.containers
  })
  .get('/:id/containers/:containerId/logs', async ({ params, query, set }) => {
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