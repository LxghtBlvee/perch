import type { HubMessage } from '@perch/types';
import { config } from './config/config.validation';

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