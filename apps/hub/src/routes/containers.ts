import Elysia from 'elysia'
import { agentRegistry } from '../services/agent-registry'

export const containerRoutes = new Elysia({ prefix: '/api/containers' })
  .get('/', () =>
    agentRegistry.getAll().flatMap(({ agent, containers }) =>
      containers.map(c => ({ ...c, agentId: agent.id, agentHostname: agent.hostname }))
    )
  )