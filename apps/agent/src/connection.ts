import type { HubMessage } from '@perch/types';
import { config } from './config/config.validation';

function parseDockerLogs(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    // Detect Docker multiplexed stream (8-byte header per frame)
    if (bytes.length >= 8 && bytes[0] <= 2 && bytes[1] === 0 && bytes[2] === 0 && bytes[3] === 0) {
        const lines: string[] = []
        let offset = 0
        const decoder = new TextDecoder()
        while (offset + 8 <= bytes.length) {
            const size = ((bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7]) >>> 0
            offset += 8
            if (size === 0) continue
            if (offset + size > bytes.length) break
            lines.push(decoder.decode(bytes.slice(offset, offset + size)))
            offset += size
        }
        return lines.join('')
    }
    // Raw stream (TTY mode)
    return new TextDecoder().decode(bytes)
}

const RECONNECT_DELAY = 5_000

export class AgentConnection {
    private ws: WebSocket | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private agentId: string,
        private hostname: string,
        private ip: string,
    ) {}

    connect(): void {
        const url = config.hubUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws/agent'
        this.ws = new WebSocket(url)

        this.ws.onopen = () => {
            console.warn('Connected to hub, authenticating...')
            this.send({
                type: 'auth',
                token: config.hubToken,
                agentId: this.agentId,
                hostname: this.hostname,
                ip: this.ip,
            })
        }

        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data as string) as HubMessage
            if (msg.type === 'auth_ok') {
                console.warn(`Authenticated with hub as ${msg.agentId}`);
            } else if (msg.type === 'auth_error') {
                console.error(`Authentication rejected: ${msg.message}`)
                this.ws?.close()
            } else if (msg.type === 'logs_request') {
                void this.handleLogsRequest(msg.requestId, msg.containerId, msg.tail)
            }
        }

        this.ws.onclose = () => {
            console.warn(`Disconnected from hub. Reconnecting in ${RECONNECT_DELAY / 1000}s...`)
            this.scheduleReconnect()
        }

        this.ws.onerror = () => {
            console.error(`WebSocket error; connection will retry`)
        }
    }

    private async handleLogsRequest(requestId: string, containerId: string, tail: number): Promise<void> {
        // Defense in depth: only Docker hex IDs may be interpolated into the API path. Anything else could path-inject into other Docker Engine endpoints.
        if (!/^[a-f0-9]{12,64}$/.test(containerId)) {
            this.send({ type: 'logs_response', requestId, logs: 'Error fetching logs: invalid container id' })
            return
        }
        const safeTail = Number.isFinite(tail) ? Math.min(Math.max(Math.trunc(tail), 1), 1000) : 200
        try {
            const res = await fetch(
                `http://localhost/containers/${containerId}/logs?stdout=1&stderr=1&tail=${safeTail}&timestamps=false`,
                { unix: '/var/run/docker.sock' } as RequestInit,
            )
            const buffer = await res.arrayBuffer()
            this.send({ type: 'logs_response', requestId, logs: parseDockerLogs(buffer) })
        } catch (e) {
            this.send({ type: 'logs_response', requestId, logs: `Error fetching logs: ${e}` })
        }
    }

    send(payload: Record<string, unknown>): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload))
        }
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) return
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connect()
        }, RECONNECT_DELAY)
    }
}