import type { HubMessage } from '@perch/types';
import { config } from './config/config.validation';

/**
 * Follows a container's logs, calling `onLine` per line until `signal` aborts.
 * Supplied by the registry so the connection layer stays runtime-agnostic.
 */
export type StreamProvider = (
    containerId: string,
    tail: number,
    onLine: (line: string) => void,
    signal: AbortSignal,
) => Promise<void>

const RECONNECT_DELAY = 5_000

export class AgentConnection {
    private ws: WebSocket | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    // Active log follows, keyed by the hub-assigned streamId.
    private streams = new Map<string, AbortController>();

    constructor(
        private agentId: string,
        private hostname: string,
        private ip: string,
        private streamProvider: StreamProvider,
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
            } else if (msg.type === 'log_stream_start') {
                void this.handleStreamStart(msg.streamId, msg.containerId, msg.tail)
            } else if (msg.type === 'log_stream_stop') {
                this.handleStreamStop(msg.streamId)
            }
        }

        this.ws.onclose = () => {
            console.warn(`Disconnected from hub. Reconnecting in ${RECONNECT_DELAY / 1000}s...`)
            // Drop any in-flight follows; the hub will re-subscribe after reconnect.
            for (const controller of this.streams.values()) controller.abort()
            this.streams.clear()
            this.scheduleReconnect()
        }

        this.ws.onerror = () => {
            console.error(`WebSocket error; connection will retry`)
        }
    }

    private async handleStreamStart(streamId: string, containerId: string, tail: number): Promise<void> {
        // Replace any existing stream with the same id (re-subscribe).
        this.streams.get(streamId)?.abort()
        const controller = new AbortController()
        this.streams.set(streamId, controller)
        try {
            await this.streamProvider(
                containerId,
                tail,
                (line) => this.send({ type: 'log_stream_data', streamId, line }),
                controller.signal,
            )
            if (!controller.signal.aborted) this.send({ type: 'log_stream_end', streamId })
        } catch (e) {
            if (!controller.signal.aborted) {
                this.send({ type: 'log_stream_error', streamId, message: e instanceof Error ? e.message : String(e) })
            }
        } finally {
            this.streams.delete(streamId)
        }
    }

    private handleStreamStop(streamId: string): void {
        this.streams.get(streamId)?.abort()
        this.streams.delete(streamId)
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