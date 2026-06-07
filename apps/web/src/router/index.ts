import { createRouter, createWebHistory } from 'vue-router'
import Overview from '@/pages/Overview.vue'
import Hosts from '@/pages/Hosts.vue'
import AgentDetail from '@/pages/AgentDetail.vue'
import ContainerDetail from '@/pages/ContainerDetail.vue'
import HealthChecks from '@/pages/HealthChecks.vue'
import HealthCheckDetail from '@/pages/HealthCheckDetail.vue'
import DataSources from '@/pages/DataSources.vue'
import Settings from '@/pages/Settings.vue'

export default createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', component: Overview },
        { path: '/hosts', component: Hosts },
        { path: '/agents/:id', component: AgentDetail },
        { path: '/agents/:agentId/containers/:containerId', component: ContainerDetail },
        { path: '/health-checks', component: HealthChecks },
        { path: '/health-checks/:id', component: HealthCheckDetail },
        { path: '/data-sources', component: DataSources },
        { path: '/settings', component: Settings },
    ],
})
