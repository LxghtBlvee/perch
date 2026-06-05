<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { LayoutDashboard, HeartPulse, Settings, Bird } from 'lucide-vue-next'
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
        <Bird
          class="size-6 text-primary"
          :stroke-width="1.5"
        />
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
