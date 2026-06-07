import type { Agent, SystemMetrics, Container, AgentState } from '@perch/types'

interface WsSender {
    send(data: string): void
}

interface ConnectedAgent extends AgentState {
    ws: WsSender
}

class AgentRegistry {
    private agents = new Map<string, ConnectedAgent>()
    private pendingLogs = new Map<string, (logs: string) => void>()

    register(agent: Agent, ws: unknown): void {
        this.agents.set(agent.id, { agent, metrics: null, containers: [], ws });
    }

    unregister(agentId: string): void {
        this.agents.delete(agentId);
    }

    updateMetrics(agentId: string, metrics: SystemMetrics): void {
        const entry = this.agents.get(agentId)
        if (entry) entry.metrics = metrics
    }

    updateContainers(agentId: string, containers: Container[]): void {
        const entry = this.agents.get(agentId);
        if (entry) entry.containers = containers;
    }

    getAll(): AgentState[] {
        return Array.from(this.agents.values()).map(({ agent, metrics, containers }) => ({
            agent,
            metrics,
            containers,
        }));
    }

    get(id: string): AgentState | undefined {
        const entry = this.agents.get(id)
        if (!entry) return undefined
        return { agent: entry.agent, metrics: entry.metrics, containers: entry.containers }
    }

    requestLogs(agentId: string, containerId: string, tail = 200): Promise<string> {
        return new Promise((resolve, reject) => {
            const entry = this.agents.get(agentId)
            if (!entry) return reject(new Error('Agent not connected'))

            const requestId = crypto.randomUUID()
            const timeout = setTimeout(() => {
                this.pendingLogs.delete(requestId)
                reject(new Error('Log request timed out'))
            }, 15_000)

            this.pendingLogs.set(requestId, (logs) => {
                clearTimeout(timeout)
                this.pendingLogs.delete(requestId)
                resolve(logs)
            })

            entry.ws.send(JSON.stringify({ type: 'logs_request', requestId, containerId, tail }))
        })
    }

    resolveLogsResponse(requestId: string, logs: string): void {
        this.pendingLogs.get(requestId)?.(logs)
    }
}

export const agentRegistry = new AgentRegistry()