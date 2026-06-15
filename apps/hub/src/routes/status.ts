import Elysia from 'elysia'
import { agentRegistry } from '../services/agent-registry'
import { getLocation } from '../services/hub-location'

export const statusRoutes = new Elysia().get('/api/status', () => {
    const agents = agentRegistry.getAll()
    return {
        name: 'perch',
        agents: {
            total: agents.length,
            online: agents.filter(a => a.agent.status === 'online').length,
        },
    }
})