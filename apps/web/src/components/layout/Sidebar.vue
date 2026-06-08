<script setup lang="ts">
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { LayoutDashboard, Server, HeartPulse, Bell, Database, Settings, Users, LogOut, Sliders, Globe, KeyRound } from 'lucide-vue-next'
import { usePerchStore } from '@/stores/perch'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'

const route = useRoute()
const router = useRouter()
const store = usePerchStore()
const auth = useAuthStore()

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/hosts', icon: Server, label: 'Hosts' },
  { to: '/health-checks', icon: HeartPulse, label: 'Health Checks' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
]

const bottomNav = [
  { to: '/data-sources', icon: Database, label: 'Data Sources' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <aside class="flex flex-col w-56 shrink-0 border-r border-sidebar-border bg-sidebar h-screen sticky top-0">
    <div class="p-5 border-b border-sidebar-border">
      <RouterLink
        to="/"
        class="flex items-center gap-3"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 100 100"
          fill="none"
          class="size-6 text-primary"
          aria-label="Perch"
        >
          <line
            x1="2"
            y1="80"
            x2="98"
            y2="80"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
          <path
            fill="currentColor"
            fill-rule="evenodd"
            d="M 22 58 C 14 50 16 38 26 34 C 30 24 46 20 58 24 C 64 18 76 20 78 28 C 80 30 82 33 82 36 L 92 38 L 94 40 L 84 43 C 82 48 76 52 68 54 C 64 60 56 62 48 62 L 30 62 L 12 60 L 22 58 Z M 70 30.5 a 1.5 1.5 0 1 0 0 3 a 1.5 1.5 0 1 0 0 -3 Z"
          />
          <line
            x1="40"
            y1="62"
            x2="40"
            y2="80"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
          <line
            x1="52"
            y1="62"
            x2="52"
            y2="80"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
        <span class="text-lg font-semibold tracking-tight">Perch</span>
      </RouterLink>
    </div>

    <nav class="flex flex-col gap-1 p-3 flex-1">
      <RouterLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        :class="cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          route.path === item.to
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )"
      >
        <component
          :is="item.icon"
          class="size-4 shrink-0"
          :stroke-width="1.75"
        />
        {{ item.label }}
      </RouterLink>

      <div class="my-2 border-t border-sidebar-border" />

      <RouterLink
        v-for="item in bottomNav"
        :key="item.to"
        :to="item.to"
        :class="cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          route.path === item.to
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )"
      >
        <component
          :is="item.icon"
          class="size-4 shrink-0"
          :stroke-width="1.75"
        />
        {{ item.label }}
      </RouterLink>

      <!-- Admin section -->
      <template v-if="auth.isAdmin">
        <div class="my-2 border-t border-sidebar-border" />
        <RouterLink
          to="/admin/users"
          :class="cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            route.path === '/admin/users'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )"
        >
          <Users
            class="size-4 shrink-0"
            :stroke-width="1.75"
          />
          Users
        </RouterLink>
        <RouterLink
          to="/admin/status-pages"
          :class="cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            route.path.startsWith('/admin/status-pages')
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )"
        >
          <Globe
            class="size-4 shrink-0"
            :stroke-width="1.75"
          />
          Status Pages
        </RouterLink>
        <RouterLink
          to="/admin/auth"
          :class="cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            route.path === '/admin/auth'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )"
        >
          <KeyRound
            class="size-4 shrink-0"
            :stroke-width="1.75"
          />
          Auth
        </RouterLink>
        <RouterLink
          to="/admin/instance"
          :class="cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            route.path === '/admin/instance'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )"
        >
          <Sliders
            class="size-4 shrink-0"
            :stroke-width="1.75"
          />
          Instance
        </RouterLink>
      </template>
    </nav>

    <!-- Footer: connection status + user -->
    <div class="p-3 border-t border-sidebar-border space-y-2">
      <div class="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <div :class="cn('size-2 rounded-full shrink-0', store.connected ? 'bg-green-500' : 'bg-amber-500 animate-pulse')" />
        <span>{{ store.connected ? 'Connected' : 'Reconnecting...' }}</span>
      </div>

      <div
        v-if="auth.user"
        class="flex items-center gap-2 rounded-lg px-1 py-1"
      >
        <RouterLink
          to="/profile"
          class="flex items-center gap-2 flex-1 min-w-0 rounded hover:bg-accent transition-colors"
        >
          <div class="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            <img
              v-if="auth.user.avatarUrl"
              :src="auth.user.avatarUrl"
              class="size-6 object-cover"
            >
            <span
              v-else
              class="text-[10px] font-semibold text-primary"
            >
              {{ (auth.user.name ?? auth.user.email)[0].toUpperCase() }}
            </span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium truncate">
              {{ auth.user.name ?? auth.user.email }}
            </p>
            <p class="text-[10px] text-muted-foreground capitalize">
              {{ auth.user.role }}
            </p>
          </div>
        </RouterLink>
        <button
          class="size-6 rounded flex items-center justify-center hover:bg-accent transition-colors shrink-0"
          title="Sign out"
          @click="handleLogout"
        >
          <LogOut
            class="size-3.5 text-muted-foreground"
            :stroke-width="1.75"
          />
        </button>
      </div>
    </div>
  </aside>
</template>
