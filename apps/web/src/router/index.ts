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
import Instance from '@/pages/admin/Instance.vue'
import StatusPages from '@/pages/admin/StatusPages.vue'
import StatusPageEdit from '@/pages/admin/StatusPageEdit.vue'
import StatusPage from '@/pages/StatusPage.vue'
import Alerts from '@/pages/Alerts.vue'
import Profile from '@/pages/Profile.vue'
import NotFound from '@/pages/NotFound.vue'
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
        { path: '/admin/instance', component: Instance, meta: { requiresAdmin: true } },
        { path: '/admin/status-pages', component: StatusPages, meta: { requiresAdmin: true } },
        { path: '/admin/status-pages/:id', component: StatusPageEdit, meta: { requiresAdmin: true } },
        { path: '/status/:slug', component: StatusPage, meta: { public: true } },
        { path: '/profile', component: Profile },
        { path: '/:pathMatch(.*)*', component: NotFound, meta: { public: true } },
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
