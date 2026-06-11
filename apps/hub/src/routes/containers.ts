import Elysia from 'elysia'
import { agentRegistry } from '../services/agent-registry'
import { requireAuthUser } from '../middleware/auth'

export const containerRoutes = new Elysia({ prefix: '/api/containers' })
  .get('/', async ({ request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    return agentRegistry.getAll().flatMap(({ agent, containers }) =>
      containers.map(c => ({ ...c, agentId: agent.id, agentHostname: agent.hostname }))
    )
  })