import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AgentState, HealthCheck, LiveMessage } from '@perch/types'

export const usePerchStore = defineStore('perch', () => {
    const agents = ref<AgentState[]>([]);
    const healthChecks = ref<HealthCheck[]>([]);
    const connected = ref(false);

    function handleMessage(msg: LiveMessage) {
        switch (msg.type) {
            case 'init':
                agents.value = msg.agents;
                healthChecks.value = msg.healthChecks;
                connected.value = true;
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

    return { agents, healthChecks, connected, handleMessage };
})