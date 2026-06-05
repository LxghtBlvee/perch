<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Server, Container, HeartPulse, Cpu, MemoryStick } from 'lucide-vue-next'
import { usePerchStore } from '@/stores/perch'
import { formatPercent, formatBytes, formatUptime } from '@/lib/utils'

const store = usePerchStore()
const router = useRouter()

const stats = computed(() => ({
  agentsOnline: store.agents.filter(a => a.agent.status === 'online').length,
  totalAgents: store.agents.length,
  containersRunning: store.agents.reduce((acc, a) => acc + a.containers.filter(c => c.status === 'running').length, 0),
  healthUp: store.healthChecks.filter(h => h.status === 'up').length,
  healthTotal: store.healthChecks.length,
}))
</script>

<template>
  <div class="p-6 space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Overview</h1>
      <p class="text-sm text-muted-foreground mt-1">All systems at a glance.</p>
    </div>

    <!-- Summary strip -->
    <div class="grid grid-cols-3 gap-4">
      <div class="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
        <div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Server class="size-5 text-primary" :stroke-width="1.75" />
        </div>
        <div>
          <p class="text-2xl font-bold">
            {{ stats.agentsOnline }}<span class="text-muted-foreground text-base font-normal">/{{ stats.totalAgents }}</span>
          </p>
          <p class="text-xs text-muted-foreground">Agents online</p>
        </div>
      </div>

      <div class="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
        <div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Container class="size-5 text-primary" :stroke-width="1.75" />
        </div>
        <div>
          <p class="text-2xl font-bold">{{ stats.containersRunning }}</p>
          <p class="text-xs text-muted-foreground">Containers running</p>
        </div>
      </div>

      <div class="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
        <div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <HeartPulse class="size-5 text-primary" :stroke-width="1.75" />
        </div>
        <div>
          <p class="text-2xl font-bold">
            {{ stats.healthUp }}<span class="text-muted-foreground text-base font-normal">/{{ stats.healthTotal }}</span>
          </p>
          <p class="text-xs text-muted-foreground">Health checks up</p>
        </div>
      </div>
    </div>

    <!-- Agent cards -->
    <div>
      <h2 class="text-sm font-medium text-muted-foreground mb-3">Agents</h2>

      <div v-if="store.agents.length === 0" class="rounded-xl border border-dashed border-border p-12 flex flex-col items-center gap-3 text-center">
        <Server class="size-8 text-muted-foreground/40" :stroke-width="1.5" />
        <p class="text-sm text-muted-foreground">No agents connected yet.</p>
        <p class="text-xs text-muted-foreground/60">Deploy the Perch agent on a host to start seeing data.</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <button
          v-for="entry in store.agents"
          :key="entry.agent.id"
          class="rounded-xl border border-border bg-card p-5 text-left hover:border-primary/40 transition-colors cursor-pointer"
          @click="router.push(`/agents/${entry.agent.id}`)"
        >
          <div class="flex items-start justify-between mb-4">
            <div>
              <p class="font-semibold text-sm">{{ entry.agent.hostname }}</p>
              <p class="text-xs text-muted-foreground font-mono mt-0.5">{{ entry.agent.ip }}</p>
            </div>
            <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', entry.agent.status === 'online' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-amber-500/10 text-amber-600']">
              {{ entry.agent.status }}
            </span>
          </div>

          <div v-if="entry.metrics" class="space-y-3">
            <div class="space-y-1">
              <div class="flex justify-between text-xs text-muted-foreground">
                <span class="flex items-center gap-1.5"><Cpu class="size-3" :stroke-width="2" /> CPU</span>
                <span>{{ formatPercent(entry.metrics.cpu.usage) }}</span>
              </div>
              <div class="h-1.5 bg-muted rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full transition-all" :style="{ width: `${Math.min(entry.metrics.cpu.usage, 100)}%` }" />
              </div>
            </div>

            <div class="space-y-1">
              <div class="flex justify-between text-xs text-muted-foreground">
                <span class="flex items-center gap-1.5"><MemoryStick class="size-3" :stroke-width="2" /> Memory</span>
                <span>{{ formatBytes(entry.metrics.memory.used) }} / {{ formatBytes(entry.metrics.memory.total) }}</span>
              </div>
              <div class="h-1.5 bg-muted rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full transition-all" :style="{ width: `${Math.min((entry.metrics.memory.used / entry.metrics.memory.total) * 100, 100)}%` }" />
              </div>
            </div>
          </div>

          <div v-else class="space-y-2">
            <div class="h-4 bg-muted rounded animate-pulse" />
            <div class="h-4 bg-muted rounded animate-pulse w-3/4" />
          </div>

          <div class="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>{{ entry.containers.filter(c => c.status === 'running').length }} / {{ entry.containers.length }} containers</span>
            <span v-if="entry.metrics">up {{ formatUptime(entry.metrics.uptime) }}</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
