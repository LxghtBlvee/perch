import { onMounted, onUnmounted } from 'vue'
import { usePerchStore } from '@/stores/perch'
import { useAuthStore } from '@/stores/auth'
import type { LiveMessage } from '@perch/types'

const RECONNECT_DELAY = 5_000

export function usePerchSocket() {
    const store = usePerchStore()
    const auth = useAuthStore()
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
        if (!auth.token) return
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
        ws = new WebSocket(`${protocol}//${location.host}/ws/live?token=${auth.token}`)

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data as string) as LiveMessage
            store.handleMessage(msg)
        }

        ws.onclose = () => {
            store.connected = false
            reconnectTimer = setTimeout(connect, RECONNECT_DELAY)
        }

        ws.onerror = () => ws?.close()
    }

    onMounted(connect)

    onUnmounted(() => {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        ws?.close()
    })
}