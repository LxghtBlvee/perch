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