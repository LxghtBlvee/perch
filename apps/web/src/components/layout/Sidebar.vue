<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { LayoutDashboard, HeartPulse, Settings } from 'lucide-vue-next'
import { usePerchStore } from '@/stores/perch'
import { cn } from '@/lib/utils'

const route = useRoute()
const store = usePerchStore()

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/health-checks', icon: HeartPulse, label: 'Health Checks' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]
</script>

<template>
  <aside class="flex flex-col w-56 shrink-0 border-r border-sidebar-border bg-sidebar h-screen sticky top-0">
    <div class="p-5 border-b border-sidebar-border">
      <RouterLink
        to="/"
        class="flex items-center gap-3"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" class="size-6 text-primary" aria-label="Perch">
            <line x1="2" y1="80" x2="98" y2="80" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            <path fill="currentColor" fill-rule="evenodd" d="M 22 58 C 14 50 16 38 26 34 C 30 24 46 20 58 24 C 64 18 76 20 78 28 C 80 30 82 33 82 36 L 92 38 L 94 40 L 84 43 C 82 48 76 52 68 54 C 64 60 56 62 48 62 L 30 62 L 12 60 L 22 58 Z M 70 30.5 a 1.5 1.5 0 1 0 0 3 a 1.5 1.5 0 1 0 0 -3 Z" />
            <line x1="40" y1="62" x2="40" y2="80" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            <line x1="52" y1="62" x2="52" y2="80" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
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
    </nav>

    <div class="p-4 border-t border-sidebar-border">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <div :class="cn('size-2 rounded-full', store.connected ? 'bg-green-500' : 'bg-amber-500 animate-pulse')" />
        <span>{{ store.connected ? 'Connected' : 'Reconnecting...' }}</span>
      </div>
    </div>
  </aside>
</template>
