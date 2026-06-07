import { createRouter, createWebHistory } from 'vue-router'
import Overview from '@/pages/Overview.vue'
import Hosts from '@/pages/Hosts.vue'
import AgentDetail from '@/pages/AgentDetail.vue'
import ContainerDetail from '@/pages/ContainerDetail.vue'
import HealthChecks from '@/pages/HealthChecks.vue'
import HealthCheckDetail from '@/pages/HealthCheckDetail.vue'
import DataSources from '@/pages/DataSources.vue'
import Settings from '@/pages/Settings.vue'
import Login from '@/pages/Login.vue'
import Users from '@/pages/admin/Users.vue'
import Alerts from '@/pages/Alerts.vue'
import Profile from '@/pages/Profile.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/login', component: Login, meta: { public: true } },
        { path: '/', component: Overview },
        { path: '/hosts', component: Hosts },
        { path: '/agents/:id', component: AgentDetail },
        { path: '/agents/:agentId/containers/:containerId', component: ContainerDetail },
        { path: '/health-checks', component: HealthChecks },
        { path: '/health-checks/:id', component: HealthCheckDetail },
        { path: '/alerts', component: Alerts },
        { path: '/data-sources', component: DataSources },
        { path: '/settings', component: Settings },
        { path: '/admin/users', component: Users, meta: { requiresAdmin: true } },
        { path: '/profile', component: Profile },
    ],
})

router.beforeEach(async (to) => {
    const auth = useAuthStore()

    if (to.meta.public) return true

    // Try to hydrate user if we have a token but no user yet
    if (auth.token && !auth.user) {
        await auth.fetchMe()
    }

    if (!auth.isAuthenticated) return '/login'
    if (to.meta.requiresAdmin && !auth.isAdmin) return '/'

    return true
})

export default router
