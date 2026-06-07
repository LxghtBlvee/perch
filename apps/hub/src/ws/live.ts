import Elysia from 'elysia'
import { desc, eq } from 'drizzle-orm'
import { liveRegistry } from '../services/live-registry'
import { agentRegistry } from '../services/agent-registry'
import { db } from '../db'
import { healthChecks, healthCheckResults } from '../db/schema'
import { validateSession } from '../services/auth'

export const liveWs = new Elysia().ws('/ws/live', {
    async open(ws) {
        // Auth check — parse token from upgrade request URL directly
        try {
            const rawUrl = ws.data.request.url
            const token = new URLSearchParams(rawUrl.includes('?') ? rawUrl.split('?')[1] : '').get('token')
            if (!token) {
                ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }))
                ws.close()
                return
            }
            const user = await validateSession(token)
            if (!user) {
                ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }))
                ws.close()
                return
            }
        } catch (err) {
            console.error('[ws/live] auth error', err)
            ws.close()
            return
        }

        liveRegistry.add(ws)

        const allChecks = await db.select().from(healthChecks)
        const checksWithStatus = await Promise.all(
            allChecks.map(async (check) => {
                const [latest] = await db
                    .select()
                    .from(healthCheckResults)
                    .where(eq(healthCheckResults.healthCheckId, check.id))
                    .orderBy(desc(healthCheckResults.checkedAt))
                    .limit(1)
                return {
                    id: check.id,
                    name: check.name,
                    url: check.url,
                    interval: check.interval,
                    status: (latest?.status ?? 'pending') as 'up' | 'down' | 'pending',
                    lastChecked: latest?.checkedAt?.toISOString() ?? null,
                    latency: latest?.latency ?? null,
                }
            })
        )

        ws.send(JSON.stringify({
            type: 'init',
            agents: agentRegistry.getAll(),
            healthChecks: checksWithStatus,
        }))
    },

    close(ws) {
        liveRegistry.remove(ws);
    },
})