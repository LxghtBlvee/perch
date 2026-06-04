import Elysia from 'elysia'
import { liveRegistry } from '../services/live-registry'
import { agentRegistry } from '../services/agent-registry'
import { db } from '../db'
import { healthChecks } from '../db/schema'

export const liveWs = new Elysia().ws('/ws/live', {
    async open(ws) {
        liveRegistry.add(ws)

        const allChecks = await db.select().from(healthChecks)

        ws.send(JSON.stringify({
            type: 'init',
            agents: agentRegistry.getAll(),
            healthChecks: allChecks,
        }))
    },

    close(ws) {
        liveRegistry.remove(ws);
    },
})