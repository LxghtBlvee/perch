import type { LiveMessage } from '@perch/types'

interface WsClient {
    send(data: string): void
}

class LiveRegistry {
    private clients = new Set<WsClient>()

    add(ws: WsClient): void {
        this.clients.add(ws)
    }

    remove(ws: WsClient): void {
        this.clients.delete(ws)
    }

    broadcast(msg: LiveMessage): void {
        const data = JSON.stringify(msg)
        for (const ws of this.clients) {
            try {
                ws.send(data)
            } catch {
                this.clients.delete(ws)
            }
        }
    }
}

export const liveRegistry = new LiveRegistry();