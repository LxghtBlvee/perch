import { onMounted, onUnmounted } from 'vue'
import { usePerchStore } from '@/stores/perch'
import type { LiveMessage } from '@perch/types'

const RECONNECT_DELAY = 5_000

export function usePerchSocket() {
    const store = usePerchStore();
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
        ws = new WebSocket(`${protocol}//${location.host}/ws/live`);

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data as string) as LiveMessage;
            store.handleMessage(msg);
        }

        ws.onclose = () => {
            store.connected = false;
            reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
        }

        ws.onerror = () => ws?.close()
    }

    onMounted(connect);

    onUnmounted(() => {
        if (reconnectTimer) clearTimeout(reconnectTimer)
            ws?.close()
    })
}