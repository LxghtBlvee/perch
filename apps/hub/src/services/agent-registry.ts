import type { Agent, SystemMetrics, Container, AgentState } from '@perch/types'

interface ConnectedAgent extends AgentState {
    ws: unknown
}

class AgentRegistry {
    private agents = new Map<string, ConnectedAgent>()

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
}

export const agentRegistry = new AgentRegistry()