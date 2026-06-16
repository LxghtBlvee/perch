import Elysia from 'elysia'
import { timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.validation'
import { agentRegistry } from '../services/agent-registry'
import { liveRegistry } from '../services/live-registry'
import { alertManager } from '../services/alert-manager'
import { db } from '../db'
import { agents } from '../db/schema'
import type { AgentMessage } from '@perch/types'

// maps ws.id to agentId
const connectionMap = new Map<string, string>()
// auth timeout handles: drop connections that never send an auth message
const authTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
const AUTH_TIMEOUT_MS = 5_000

/** Constant-time token comparison to avoid leaking the hub token via timing. */
function tokenMatches(provided: unknown, expected: string): boolean {
    if (typeof provided !== 'string') return false
    const a = Buffer.from(provided)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
}

export const agentWs = new Elysia().ws('/ws/agent', {
    open(ws) {
        const timeout = setTimeout(() => {
            if (!connectionMap.has(ws.id)) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Authentication timeout' }))
                ws.close()
            }
            authTimeouts.delete(ws.id)
        }, AUTH_TIMEOUT_MS)
        authTimeouts.set(ws.id, timeout)
        console.warn(`Agent socket opened: ${ws.id}`)
    },

    async message(ws, raw) {
        const msg = (typeof raw === 'string' ? JSON.parse(raw) : raw) as AgentMessage
        
        if (msg.type === 'auth') {
            if (!tokenMatches(msg.token, env.hubToken)) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }))
                ws.close()
                return
            }
            // Clear the auth timeout — connection is authenticated
            const t = authTimeouts.get(ws.id)
            if (t) { clearTimeout(t); authTimeouts.delete(ws.id) }

            const [row] = await db.insert(agents).values({ id: msg.agentId, hostname: msg.hostname, ip: msg.ip }).onConflictDoUpdate({
                target: agents.id,
                set: { hostname: msg.hostname, ip: msg.ip, lastSeen: new Date() },
            }).returning();

            const agent = {
                id: msg.agentId,
                hostname: msg.hostname,
                displayName: row.displayName ?? null,
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
            const prevContainers = agentRegistry.getContainers(agentId)
            agentRegistry.updateContainers(agentId, msg.data)
            liveRegistry.broadcast({ type: 'containers_update', agentId, containers: msg.data })

            // Detect crash / restart events by diffing against previous state
            if (prevContainers && prevContainers.length > 0) {
                const agentState = agentRegistry.get(agentId)
                if (agentState) {
                    const prevMap = new Map(prevContainers.map(c => [c.id, c]))
                    for (const container of msg.data) {
                        const prev = prevMap.get(container.id)
                        if (!prev) continue

                        const wentDown =
                            prev.status === 'running' &&
                            (container.status === 'stopped' || container.status === 'dead')
                        const isRestarting =
                            container.status === 'restarting' && prev.status !== 'restarting'

                        if (wentDown) {
                            void alertManager.fireContainerAlert(
                                agentId, agentState.agent.hostname,
                                container.name, container.image, 'crash'
                            )
                        } else if (isRestarting) {
                            void alertManager.fireContainerAlert(
                                agentId, agentState.agent.hostname,
                                container.name, container.image, 'restart'
                            )
                        }
                    }
                }
            }
        }

        if (msg.type === 'logs_response') {
            agentRegistry.resolveLogsResponse(msg.requestId, msg.logs)
        }
    },

    close(ws) {
        // Clean up any pending auth timeout
        const t = authTimeouts.get(ws.id)
        if (t) { clearTimeout(t); authTimeouts.delete(ws.id) }

        const agentId = connectionMap.get(ws.id)
        if (agentId) {
            agentRegistry.unregister(agentId)
            connectionMap.delete(ws.id)
            liveRegistry.broadcast({ type: 'agent_disconnected', agentId })
            console.warn(`Agent disconnected: ${agentId}`);
        }
    },
})