<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Cpu, MemoryStick, HardDrive, Network, Activity, Clock, Server } from 'lucide-vue-next'
import MetricSparkline from '@/components/MetricSparkline.vue'
import { usePerchStore } from '@/stores/perch'
import { formatBytes, formatPercent, formatUptime, formatSpeed } from '@/lib/utils'
import type { SystemMetrics } from '@perch/types'

const store = usePerchStore()
const router = useRouter()

function hist(agentId: string): SystemMetrics[] {
  return store.metricsHistory[agentId] ?? []
}

const charts = computed(() => {
  const out: Record<string, {
    ts: string[]; cpu: number[]; mem: number[]; rx: number[]; tx: number[]; maxSpd: number
  }> = {}
  for (const entry of store.agents) {
    const h = hist(entry.agent.id)
    if (h.length < 2) continue
    const rx = h.map(m => m.network.filter(n => n.interface !== 'lo').reduce((s, n) => s + n.rxSpeed, 0))
    const tx = h.map(m => m.network.filter(n => n.interface !== 'lo').reduce((s, n) => s + n.txSpeed, 0))
    out[entry.agent.id] = {
      ts: h.map(m => m.timestamp),
      cpu: h.map(m => m.cpu.usage),
      mem: h.map(m => (m.memory.used / m.memory.total) * 100),
      rx,
      tx,
      maxSpd: Math.max(1, ...rx, ...tx),
    }
  }
  return out
})

const hosts = computed(() =>
  store.agents.map(entry => {
    const m = entry.metrics
    const cpuPct = m?.cpu.usage ?? 0
    const memPct = m ? (m.memory.used / m.memory.total) * 100 : 0
    const primaryDisk = m?.disks.find(d => d.mountpoint === '/') ?? m?.disks[0]
    const diskPct = primaryDisk ? (primaryDisk.used / primaryDisk.total) * 100 : 0
    const netIfaces = m?.network.filter(n => n.interface !== 'lo') ?? []
    const totalRxSpeed = netIfaces.reduce((s, n) => s + n.rxSpeed, 0)
    const totalTxSpeed = netIfaces.reduce((s, n) => s + n.txSpeed, 0)
    return { entry, m, cpuPct, memPct, primaryDisk, diskPct, totalRxSpeed, totalTxSpeed }
  })
)
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Page header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          Hosts
        </h1>
        <p class="text-sm text-muted-foreground mt-0.5">
          {{ store.agents.filter(a => a.agent.status === 'online').length }} of {{ store.agents.length }} online
        </p>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="store.agents.length === 0"
      class="rounded-xl border border-dashed border-border p-16 flex flex-col items-center gap-4 text-center"
    >
      <Server
        class="size-10 text-muted-foreground/30"
        :stroke-width="1.25"
      />
      <div>
        <p class="text-sm font-medium text-muted-foreground">
          No hosts connected
        </p>
        <p class="text-xs text-muted-foreground/60 mt-1">
          Deploy the Perch agent on a host to start seeing data here.
        </p>
      </div>
    </div>

    <!-- Host rows -->
    <div
      v-for="{ entry, m, cpuPct, memPct, primaryDisk, diskPct, totalRxSpeed, totalTxSpeed } in hosts"
      :key="entry.agent.id"
      class="rounded-xl border border-border bg-card overflow-hidden"
    >
      <!-- Row header -->
      <button
        class="w-full flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        @click="router.push(`/agents/${entry.agent.id}`)"
      >
        <span class="relative flex size-2.5 shrink-0">
          <span
            v-if="entry.agent.status === 'online'"
            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"
          />
          <span
            :class="[
              'relative inline-flex rounded-full size-2.5',
              entry.agent.status === 'online' ? 'bg-green-500' : 'bg-amber-500',
            ]"
          />
        </span>
        <span class="font-mono font-semibold text-sm">{{ entry.agent.hostname }}</span>
        <span class="text-xs text-muted-foreground font-mono">{{ entry.agent.ip }}</span>
        <span
          v-if="m"
          class="text-xs text-muted-foreground ml-1"
        >
          {{ m.cpu.model }}
        </span>
        <span class="ml-auto text-xs text-muted-foreground">
          {{ entry.containers.filter(c => c.status === 'running').length }}/{{ entry.containers.length }} containers
        </span>
        <span class="text-xs text-muted-foreground/50">→</span>
      </button>

      <!-- Panels grid -->
      <div
        v-if="!m"
        class="p-5 flex gap-3"
      >
        <div
          v-for="i in 6"
          :key="i"
          class="flex-1 h-20 rounded-lg bg-muted/40 animate-pulse"
        />
      </div>
      <div
        v-else
        class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 divide-x divide-y xl:divide-y-0 divide-border"
      >
        <!-- CPU -->
        <div class="p-5 space-y-3">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span class="flex items-center gap-1.5 font-medium uppercase tracking-wider">
              <Cpu
                class="size-3"
                :stroke-width="2"
              /> CPU
            </span>
            <span>{{ m.cpu.cores }}c</span>
          </div>
          <p class="text-3xl font-bold tabular-nums">
            {{ formatPercent(cpuPct) }}
          </p>
          <div class="space-y-1.5">
            <div class="h-1 bg-muted rounded-full overflow-hidden">
              <div
                class="h-full rounded-full bg-primary transition-all duration-700"
                :style="{ width: `${Math.min(cpuPct, 100)}%` }"
              />
            </div>
            <p class="text-[10px] text-muted-foreground truncate">
              {{ m.cpu.model }}
            </p>
          </div>
        </div>

        <!-- Memory -->
        <div class="p-5 space-y-3">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
            <MemoryStick
              class="size-3"
              :stroke-width="2"
            /> Memory
          </div>
          <p class="text-3xl font-bold tabular-nums">
            {{ formatPercent(memPct) }}
          </p>
          <div class="space-y-1.5">
            <div class="h-1 bg-muted rounded-full overflow-hidden">
              <div
                class="h-full rounded-full bg-primary transition-all duration-700"
                :style="{ width: `${Math.min(memPct, 100)}%` }"
              />
            </div>
            <p class="text-[10px] text-muted-foreground">
              {{ formatBytes(m.memory.used) }} / {{ formatBytes(m.memory.total) }}
            </p>
          </div>
        </div>

        <!-- Disk -->
        <div class="p-5 space-y-3">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
            <HardDrive
              class="size-3"
              :stroke-width="2"
            /> Disk
          </div>
          <template v-if="primaryDisk">
            <p class="text-3xl font-bold tabular-nums">
              {{ formatPercent(diskPct) }}
            </p>
            <div class="space-y-1.5">
              <div class="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full bg-primary transition-all duration-700"
                  :style="{ width: `${Math.min(diskPct, 100)}%` }"
                />
              </div>
              <p class="text-[10px] text-muted-foreground">
                {{ formatBytes(primaryDisk.used) }} / {{ formatBytes(primaryDisk.total) }} on {{ primaryDisk.mountpoint }}
              </p>
            </div>
          </template>
          <p
            v-else
            class="text-3xl font-bold text-muted-foreground"
          >
            —
          </p>
        </div>

        <!-- Network In -->
        <div class="p-5 space-y-3">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
            <Network
              class="size-3"
              :stroke-width="2"
            /> Net In
          </div>
          <p class="text-3xl font-bold tabular-nums">
            {{ formatSpeed(totalRxSpeed) }}
          </p>
          <p class="text-[10px] text-muted-foreground">
            ↑ {{ formatSpeed(totalTxSpeed) }} out
          </p>
        </div>

        <!-- Load -->
        <div class="p-5 space-y-3">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
            <Activity
              class="size-3"
              :stroke-width="2"
            /> Load
          </div>
          <p class="text-3xl font-bold tabular-nums">
            {{ m.loadAverage[0].toFixed(2) }}
          </p>
          <p class="text-[10px] text-muted-foreground">
            {{ m.loadAverage.map(l => l.toFixed(2)).join(' · ') }}
          </p>
        </div>

        <!-- Uptime -->
        <div class="p-5 space-y-3">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
            <Clock
              class="size-3"
              :stroke-width="2"
            /> Uptime
          </div>
          <p class="text-3xl font-bold tabular-nums">
            {{ formatUptime(m.uptime) }}
          </p>
          <p class="text-[10px] text-muted-foreground">
            {{ m.cpu.cores }} cores · {{ m.network.filter(n => n.interface !== 'lo').length }} ifaces
          </p>
        </div>
      </div>

      <template v-if="charts[entry.agent.id]">
        <div class="border-t border-border px-5 pt-4 pb-5 space-y-3">
          <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Metrics History
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <!-- CPU -->
            <div class="rounded-lg bg-muted/20 border border-border/50 overflow-hidden">
              <p class="px-3 pt-2 pb-1 text-[10px] text-muted-foreground font-medium">
                CPU %
              </p>
              <MetricSparkline
                :series="[{ label: 'CPU', colorClass: 'text-primary', values: charts[entry.agent.id].cpu }]"
                :timestamps="charts[entry.agent.id].ts"
                :max="100"
                :format="formatPercent"
              />
            </div>

            <!-- Memory -->
            <div class="rounded-lg bg-muted/20 border border-border/50 overflow-hidden">
              <p class="px-3 pt-2 pb-1 text-[10px] text-muted-foreground font-medium">
                Memory %
              </p>
              <MetricSparkline
                :series="[{ label: 'Memory', colorClass: 'text-primary', values: charts[entry.agent.id].mem }]"
                :timestamps="charts[entry.agent.id].ts"
                :max="100"
                :format="formatPercent"
              />
            </div>

            <!-- Network (full width) -->
            <div class="md:col-span-2 rounded-lg bg-muted/20 border border-border/50 overflow-hidden">
              <div class="px-3 pt-2 pb-1 flex items-center gap-4 text-[10px] text-muted-foreground font-medium">
                <span>Network</span>
                <span class="flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-primary inline-block" /> RX</span>
                <span class="flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-muted-foreground inline-block" /> TX</span>
                <span class="ml-auto">max {{ formatSpeed(charts[entry.agent.id].maxSpd) }}</span>
              </div>
              <MetricSparkline
                :series="[
                  { label: 'RX', colorClass: 'text-primary', values: charts[entry.agent.id].rx },
                  { label: 'TX', colorClass: 'text-muted-foreground', values: charts[entry.agent.id].tx },
                ]"
                :timestamps="charts[entry.agent.id].ts"
                :max="charts[entry.agent.id].maxSpd"
                :format="formatSpeed"
              />
            </div>
          </div>
        </div>
      </template>

      <div
        v-if="entry.containers.length > 0"
        class="border-t border-border"
      >
        <div class="px-5 py-2.5 flex items-center justify-between">
          <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Containers
          </p>
          <span class="text-[10px] text-muted-foreground">
            {{ entry.containers.filter(c => c.status === 'running').length }}/{{ entry.containers.length }} running
          </span>
        </div>
        <div class="divide-y divide-border/40">
          <div
            v-for="c in entry.containers"
            :key="c.id"
            class="px-5 py-2 flex items-center gap-3 hover:bg-muted/20 transition-colors cursor-pointer"
            @click="router.push(`/agents/${entry.agent.id}/containers/${c.id}`)"
          >
            <!-- status -->
            <span
              :class="[
                'size-1.5 rounded-full shrink-0',
                c.status === 'running' ? 'bg-green-500' :
                c.status === 'restarting' ? 'bg-amber-400 animate-pulse' :
                'bg-muted-foreground/30',
              ]"
            />

            <!-- name -->
            <span class="font-mono text-xs font-medium w-40 truncate">{{ c.name }}</span>

            <!-- image -->
            <span class="text-[10px] text-muted-foreground font-mono flex-1 truncate hidden sm:block">{{ c.image }}</span>

            <!-- CPU bar + % -->
            <div class="flex items-center gap-2 w-24 shrink-0">
              <div class="flex-1 h-0.5 bg-muted rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary/70 rounded-full"
                  :style="{ width: `${Math.min(c.cpu, 100)}%` }"
                />
              </div>
              <span class="text-[10px] text-muted-foreground font-mono w-8 text-right">{{ formatPercent(c.cpu) }}</span>
            </div>

            <!-- Mem bar + size -->
            <div class="flex items-center gap-2 w-32 shrink-0">
              <div class="flex-1 h-0.5 bg-muted rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary/70 rounded-full"
                  :style="{ width: `${Math.min((c.memory.used / c.memory.limit) * 100, 100)}%` }"
                />
              </div>
              <span class="text-[10px] text-muted-foreground font-mono w-16 text-right">
                {{ formatBytes(c.memory.used) }} / {{ formatBytes(c.memory.limit) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
