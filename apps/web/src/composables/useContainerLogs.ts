import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { LogStreamServerMessage } from '@perch/types'

const RECONNECT_DELAY = 4_000
const MAX_LINES = 2_000
const FLUSH_INTERVAL = 100

/**
 * Follows a container's logs over the dedicated /ws/logs socket. Buffers
 * incoming lines (capped to MAX_LINES), batches DOM updates, and supports
 * pause/resume and changing the tail size (which re-subscribes).
 */
export function useContainerLogs(agentId: string, containerId: string) {
    const auth = useAuthStore()

    const logs = ref('')
    const connected = ref(false)
    const error = ref<string | null>(null)
    const paused = ref(false)
    const tail = ref(200)

    let ws: WebSocket | null = null
    let buffer: string[] = []
    let flushTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let closing = false

    function flush() {
        flushTimer = null
        if (!paused.value) logs.value = buffer.join('\n')
    }

    function scheduleFlush() {
        if (paused.value || flushTimer) return
        flushTimer = setTimeout(flush, FLUSH_INTERVAL)
    }

    function pushLine(line: string) {
        buffer.push(line)
        if (buffer.length > MAX_LINES) buffer.splice(0, buffer.length - MAX_LINES)
        scheduleFlush()
    }

    function subscribe() {
        buffer = []
        logs.value = ''
        error.value = null
        ws?.send(JSON.stringify({ type: 'subscribe', agentId, containerId, tail: tail.value }))
    }

    function connect() {
        if (!auth.token) return
        closing = false
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
        // Token via subprotocol so it never lands in URLs / access logs.
        ws = new WebSocket(`${protocol}//${location.host}/ws/logs`, ['perch.v1', `token.${auth.token}`])

        ws.onopen = () => {
            connected.value = true
            subscribe()
        }

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data as string) as LogStreamServerMessage
            if (msg.type === 'line') pushLine(msg.line)
            else if (msg.type === 'error') error.value = msg.message
            else if (msg.type === 'end') connected.value = false
        }

        ws.onclose = () => {
            connected.value = false
            if (!closing) scheduleReconnect()
        }

        ws.onerror = () => ws?.close()
    }

    function scheduleReconnect() {
        if (reconnectTimer) return
        reconnectTimer = setTimeout(() => { reconnectTimer = null; connect() }, RECONNECT_DELAY)
    }

    function disconnect() {
        closing = true
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
        if (ws) {
            ws.onclose = null
            try { ws.send(JSON.stringify({ type: 'unsubscribe' })) } catch { /* socket already closing */ }
            ws.close()
            ws = null
        }
        connected.value = false
    }

    function setTail(n: number) {
        tail.value = n
        if (connected.value) subscribe()
    }

    function togglePause() {
        paused.value = !paused.value
        if (!paused.value) logs.value = buffer.join('\n') // flush what arrived while paused
    }

    function reconnect() {
        disconnect()
        connect()
    }

    onMounted(connect)
    onUnmounted(disconnect)
    // Re-establish on login/logout without a full reload.
    watch(() => auth.token, () => reconnect())

    return { logs, connected, error, paused, tail, setTail, togglePause, reconnect }
}
