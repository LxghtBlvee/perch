import type { Agent, SystemMetrics, Container, AgentState } from '@perch/types'

interface WsSender {
    send(data: string): void
}

interface ConnectedAgent extends AgentState {
    ws: WsSender
}

interface LogStreamHandlers {
    onLine: (line: string) => void
    onEnd: () => void
    onError: (message: string) => void
}

interface LogStream extends LogStreamHandlers {
    agentId: string
}

class AgentRegistry {
    private agents = new Map<string, ConnectedAgent>()
    // Active follow streams, keyed by streamId, fanned out to subscribed clients.
    private logStreams = new Map<string, LogStream>()

    register(agent: Agent, ws: WsSender): void {
        this.agents.set(agent.id, { agent, metrics: null, containers: [], ws });
    }

    unregister(agentId: string): void {
        this.agents.delete(agentId);
        // Tear down any follows that were targeting this agent.
        for (const [streamId, stream] of this.logStreams) {
            if (stream.agentId === agentId) {
                this.logStreams.delete(streamId)
                stream.onError('Agent disconnected')
            }
        }
    }

    updateDisplayName(agentId: string, displayName: string | null): void {
        const entry = this.agents.get(agentId)
        if (entry) entry.agent.displayName = displayName
    }

    updateMetrics(agentId: string, metrics: SystemMetrics): void {
        const entry = this.agents.get(agentId)
        if (entry) entry.metrics = metrics
    }

    getContainers(agentId: string): Container[] | null {
        const entry = this.agents.get(agentId)
        return entry ? [...entry.containers] : null
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

    /** Start following a container's logs on an agent. Returns the streamId. */
    startLogStream(agentId: string, containerId: string, tail: number, handlers: LogStreamHandlers): string {
        const entry = this.agents.get(agentId)
        if (!entry) throw new Error('Agent not connected')

        const streamId = crypto.randomUUID()
        this.logStreams.set(streamId, { ...handlers, agentId })
        entry.ws.send(JSON.stringify({ type: 'log_stream_start', streamId, containerId, tail }))
        return streamId
    }

    /** Stop a follow and tell the agent to close its end. */
    stopLogStream(streamId: string): void {
        const stream = this.logStreams.get(streamId)
        if (!stream) return
        this.logStreams.delete(streamId)
        this.agents.get(stream.agentId)?.ws.send(JSON.stringify({ type: 'log_stream_stop', streamId }))
    }

    pushLogStreamData(streamId: string, line: string): void {
        this.logStreams.get(streamId)?.onLine(line)
    }

    endLogStream(streamId: string): void {
        const stream = this.logStreams.get(streamId)
        if (!stream) return
        this.logStreams.delete(streamId)
        stream.onEnd()
    }

    errorLogStream(streamId: string, message: string): void {
        const stream = this.logStreams.get(streamId)
        if (!stream) return
        this.logStreams.delete(streamId)
        stream.onError(message)
    }
}

export const agentRegistry = new AgentRegistry()