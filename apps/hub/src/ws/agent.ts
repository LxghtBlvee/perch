import Elysia from 'elysia'
import { env } from '../config/env.validation'
import { agentRegistry } from '../services/agent-registry'
import { liveRegistry } from '../services/live-registry'
import { db } from '../db'
import { agents } from '../db/schema'
import type { AgentMessage } from '@perch/types'

// maps ws.id to agentId
const connectionMap = new Map<string, string>()

export const agentWs = new Elysia().ws('/ws/agent', {
    open(ws) {
        console.log(`Agent socket opened: ${ws.id}`)
    },

    async message(ws, raw) {
        const msg = (typeof raw === 'string' ? JSON.parse(raw) : raw) as AgentMessage
        
        if (msg.type === 'auth') {
            if (msg.token !== env.hubToken) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }))
                ws.close()
                return
            }

            await db.insert(agents).values({ id: msg.agentId, hostname: msg.hostname, ip: msg.ip }).onConflictDoUpdate({
                target: agents.id,
                set: { hostname: msg.hostname, ip: msg.ip, lastSeen: new Date() },
            });

            const agent = {
                id: msg.agentId,
                hostname: msg.hostname,
                ip: msg.ip,
                connectedAt: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                status: 'online' as const,
            }

            agentRegistry.register(agent, ws);
            connectionMap.set(ws.id, msg.agentId);
            ws.send(JSON.stringify({ type: 'auth_ok', agentId: msg.agentId }));
            liveRegistry.broadcast({ type: 'agent_connected', agent: { agent, metrics: null, containers: [] } });
            return
        }

        const agentId = connectionMap.get(ws.id)
        if (!agentId) return

        if (msg.type === 'metrics') {
            agentRegistry.updateMetrics(agentId, msg.data)
            liveRegistry.broadcast({ type: 'metrics_update', agentId, metrics: msg.data })
        }

        if (msg.type === 'containers') {
            agentRegistry.updateContainers(agentId, msg.data)
            liveRegistry.broadcast({ type: 'containers_update', agentId, containers: msg.data })
        }
    },

    close(ws) {
        const agentId = connectionMap.get(ws.id)
        if (agentId) {
            agentRegistry.unregister(agentId)
            connectionMap.delete(ws.id)
            liveRegistry.broadcast({ type: 'agent_disconnected', agentId })
            console.log(`Agent disconnected: ${agentId}`);
        }
    },
})