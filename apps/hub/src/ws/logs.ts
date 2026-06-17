import Elysia from 'elysia'
import { agentRegistry } from '../services/agent-registry'
import { validateSession } from '../services/auth'
import type { LogStreamClientMessage } from '@perch/types'

// One active follow per connection. ws.id -> streamId.
const subscriptions = new Map<string, string>()

function stop(wsId: string): void {
    const streamId = subscriptions.get(wsId)
    if (streamId) {
        subscriptions.delete(wsId)
        agentRegistry.stopLogStream(streamId)
    }
}

export const logsWs = new Elysia().ws('/ws/logs', {
    async open(ws) {
        // Same auth as /ws/live: token via Sec-WebSocket-Protocol, ?token= fallback.
        try {
            const req = ws.data.request
            const offered = (req.headers.get('sec-websocket-protocol') ?? '').split(',').map(s => s.trim())
            const tokenProto = offered.find(p => p.startsWith('token.'))
            const token = tokenProto
                ? tokenProto.slice('token.'.length)
                : new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '').get('token')
            if (!token || !(await validateSession(token))) {
                ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }))
                ws.close()
            }
        } catch (err) {
            console.error('[ws/logs] auth error', err)
            ws.close()
        }
    },

    message(ws, raw) {
        const msg = (typeof raw === 'string' ? JSON.parse(raw) : raw) as LogStreamClientMessage

        if (msg.type === 'unsubscribe') {
            stop(ws.id)
            return
        }

        if (msg.type === 'subscribe') {
            stop(ws.id) // replace any existing follow on this socket

            // Container IDs are Docker hex hashes; the agent interpolates this into
            // an Engine API path, so reject anything else (path-injection guard).
            if (!/^[a-f0-9]{12,64}$/.test(msg.containerId)) {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid container ID' }))
                return
            }
            const tail = Math.min(Math.max(Math.trunc(msg.tail) || 200, 1), 1000)

            try {
                const streamId = agentRegistry.startLogStream(msg.agentId, msg.containerId, tail, {
                    onLine: (line) => ws.send(JSON.stringify({ type: 'line', line })),
                    onEnd: () => { subscriptions.delete(ws.id); ws.send(JSON.stringify({ type: 'end' })) },
                    onError: (message) => { subscriptions.delete(ws.id); ws.send(JSON.stringify({ type: 'error', message })) },
                })
                subscriptions.set(ws.id, streamId)
            } catch (e) {
                ws.send(JSON.stringify({ type: 'error', message: e instanceof Error ? e.message : 'Failed to start log stream' }))
            }
        }
    },

    close(ws) {
        stop(ws.id)
    },
})
