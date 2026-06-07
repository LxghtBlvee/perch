import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AgentState, HealthCheck, LiveMessage, SystemMetrics } from '@perch/types'

const HISTORY_MAX = 60 // ~5 min at 5s intervals

export const usePerchStore = defineStore('perch', () => {
    const agents = ref<AgentState[]>([]);
    const healthChecks = ref<HealthCheck[]>([]);
    const metricsHistory = ref<Record<string, SystemMetrics[]>>({});
    const connected = ref(false);

    function handleMessage(msg: LiveMessage) {
        switch (msg.type) {
            case 'init':
                agents.value = msg.agents;
                healthChecks.value = msg.healthChecks;
                connected.value = true;
                metricsHistory.value = {};
                for (const a of msg.agents) {
                    if (a.metrics) metricsHistory.value[a.agent.id] = [a.metrics];
                }
                break;
            case 'agent_connected':
                agents.value.push(msg.agent);
                break;
            case 'agent_disconnected':
                agents.value = agents.value.filter(a => a.agent.id != msg.agentId);
                break;
            case 'metrics_update': {
                const agent = agents.value.find(a => a.agent.id === msg.agentId)
                if (agent) agent.metrics = msg.metrics;
                if (!metricsHistory.value[msg.agentId]) metricsHistory.value[msg.agentId] = [];
                const hist = metricsHistory.value[msg.agentId];
                hist.push(msg.metrics);
                if (hist.length > HISTORY_MAX) hist.shift();
                break;
            }
            case 'containers_update': {
                const agent = agents.value.find(a => a.agent.id === msg.agentId)
                if (agent) agent.containers = msg.containers;
                break;
            };
            case 'health_check_update': {
                const idx = healthChecks.value.findIndex(h => h.id === msg.healthCheck.id);
                if (idx >= 0) healthChecks.value[idx] = msg.healthCheck;
                else healthChecks.value.push(msg.healthCheck);
                break;
            }
                
        }
    }

    return { agents, healthChecks, metricsHistory, connected, handleMessage };
})