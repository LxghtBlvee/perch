<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Cpu, MemoryStick, HardDrive, Clock } from 'lucide-vue-next'
import { usePerchStore } from '@/stores/perch'
import { formatBytes, formatPercent, formatUptime } from '@/lib/utils'

const route = useRoute()
const router = useRouter()
const store = usePerchStore()

const entry = computed(() => store.agents.find(a => a.agent.id === route.params.id))
const metrics = computed(() => entry.value?.metrics)
const containers = computed(() => entry.value?.containers ?? [])
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center gap-4">
      <button
        class="size-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors"
        @click="router.back()"
      >
        <ArrowLeft class="size-4" :stroke-width="2" />
      </button>
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{{ entry?.agent.hostname ?? 'Agent' }}</h1>
        <p class="text-sm text-muted-foreground font-mono">{{ entry?.agent.ip }}</p>
      </div>
      <span
        v-if="entry"
        :class="['ml-auto text-xs px-2.5 py-1 rounded-full font-medium', entry.agent.status === 'online' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-amber-500/10 text-amber-600']"
      >
        {{ entry.agent.status }}
      </span>
    </div>

    <div v-if="!entry" class="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
      Agent not found.
    </div>

    <template v-else>
      <!-- Metrics grid -->
      <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div class="rounded-xl border border-border bg-card p-4">
          <div class="flex items-center gap-2 text-muted-foreground text-xs mb-3">
            <Cpu class="size-3.5" :stroke-width="2" /> CPU Usage
          </div>
          <p class="text-3xl font-bold">{{ metrics ? formatPercent(metrics.cpu.usage) : '—' }}</p>
          <p class="text-xs text-muted-foreground mt-1">{{ metrics?.cpu.cores }} cores · {{ metrics?.cpu.model }}</p>
          <div v-if="metrics" class="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
            <div class="h-full bg-primary rounded-full transition-all" :style="{ width: `${Math.min(metrics.cpu.usage, 100)}%` }" />
          </div>
        </div>

        <div class="rounded-xl border border-border bg-card p-4">
          <div class="flex items-center gap-2 text-muted-foreground text-xs mb-3">
            <MemoryStick class="size-3.5" :stroke-width="2" /> Memory
          </div>
          <p class="text-3xl font-bold">{{ metrics ? formatPercent((metrics.memory.used / metrics.memory.total) * 100) : '—' }}</p>
          <p class="text-xs text-muted-foreground mt-1">{{ metrics ? `${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}` : '' }}</p>
          <div v-if="metrics" class="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
            <div class="h-full bg-primary rounded-full transition-all" :style="{ width: `${Math.min((metrics.memory.used / metrics.memory.total) * 100, 100)}%` }" />
          </div>
        </div>

        <div class="rounded-xl border border-border bg-card p-4">
          <div class="flex items-center gap-2 text-muted-foreground text-xs mb-3">
            <Clock class="size-3.5" :stroke-width="2" /> Uptime
          </div>
          <p class="text-3xl font-bold">{{ metrics ? formatUptime(metrics.uptime) : '—' }}</p>
          <p class="text-xs text-muted-foreground mt-1">
            Load: {{ metrics?.loadAverage.map(l => l.toFixed(2)).join(' · ') }}
          </p>
        </div>

        <div class="rounded-xl border border-border bg-card p-4">
          <div class="flex items-center gap-2 text-muted-foreground text-xs mb-3">
            <HardDrive class="size-3.5" :stroke-width="2" /> Disk
          </div>
          <template v-if="metrics?.disks[0]">
            <p class="text-3xl font-bold">{{ formatPercent((metrics.disks[0].used / metrics.disks[0].total) * 100) }}</p>
            <p class="text-xs text-muted-foreground mt-1">{{ formatBytes(metrics.disks[0].used) }} / {{ formatBytes(metrics.disks[0].total) }}</p>
            <div class="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
              <div class="h-full bg-primary rounded-full transition-all" :style="{ width: `${Math.min((metrics.disks[0].used / metrics.disks[0].total) * 100, 100)}%` }" />
            </div>
          </template>
          <p v-else class="text-3xl font-bold">—</p>
        </div>
      </div>

      <!-- Containers -->
      <div>
        <h2 class="text-sm font-medium text-muted-foreground mb-3">Containers</h2>
        <div class="rounded-xl border border-border overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-muted/40">
                <th class="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
                <th class="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Image</th>
                <th class="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                <th class="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">CPU</th>
                <th class="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Memory</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="containers.length === 0">
                <td colspan="5" class="px-4 py-8 text-center text-muted-foreground text-xs">No containers found.</td>
              </tr>
              <tr
                v-for="c in containers"
                :key="c.id"
                class="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td class="px-4 py-3 font-medium font-mono text-xs">{{ c.name }}</td>
                <td class="px-4 py-3 text-muted-foreground font-mono text-xs truncate max-w-40">{{ c.image }}</td>
                <td class="px-4 py-3">
                  <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', {
                    'bg-green-500/10 text-green-600 dark:text-green-400': c.status === 'running',
                    'bg-muted text-muted-foreground': c.status === 'stopped',
                    'bg-amber-500/10 text-amber-600': c.status === 'restarting',
                    'bg-red-500/10 text-red-600': c.status === 'dead',
                  }]">{{ c.status }}</span>
                </td>
                <td class="px-4 py-3 text-right text-xs text-muted-foreground font-mono">{{ formatPercent(c.cpu) }}</td>
                <td class="px-4 py-3 text-right text-xs text-muted-foreground font-mono">{{ formatBytes(c.memory.used) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
