import { createRouter, createWebHistory } from 'vue-router'
import Overview from '@/pages/Overview.vue'
import AgentDetail from '@/pages/AgentDetail.vue'
import HealthChecks from '@/pages/HealthChecks.vue'
import Settings from '@/pages/Settings.vue'

export default createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', component: Overview },
        { path: '/agents/:id', component: AgentDetail },
        { path: '/health-checks', component: HealthChecks },
        { path: '/settings', component: Settings },
    ],
})