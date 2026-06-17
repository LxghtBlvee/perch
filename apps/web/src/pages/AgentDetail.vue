<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Cpu, MemoryStick, HardDrive, Clock, Pencil, Trash2, Check, X } from 'lucide-vue-next'
import Tooltip from '@/components/Tooltip.vue'
import { usePerchStore } from '@/stores/perch'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import { formatBytes, formatPercent, formatUptime, formatSpeed } from '@/lib/utils'

const route = useRoute()
const router = useRouter()
const store = usePerchStore()
const auth = useAuthStore()
const { confirm } = useConfirm()

const entry = computed(() => store.agents.find(a => a.agent.id === route.params.id))
const metrics = computed(() => entry.value?.metrics)
const containers = computed(() => entry.value?.containers ?? [])

// Rename
const renaming = ref(false)
const renameInput = ref('')
const renameInputEl = ref<HTMLInputElement | null>(null)

function startRename() {
  renameInput.value = entry.value?.agent.displayName ?? entry.value?.agent.hostname ?? ''
  renaming.value = true
  nextTick(() => renameInputEl.value?.select())
}

async function saveRename() {
  const agentId = entry.value?.agent.id
  if (!agentId) return
  const displayName = renameInput.value.trim() || null
  const res = await fetch(`/api/agents/${agentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ displayName }),
  })
  if (res.ok) store.updateAgent(agentId, { displayName })
  renaming.value = false
}

function cancelRename() {
  renaming.value = false
}

// Delete
async function deleteAgent() {
  const agentId = entry.value?.agent.id
  const name = entry.value?.agent.displayName ?? entry.value?.agent.hostname
  if (!agentId) return
  const ok = await confirm({ title: `Remove "${name}"?`, message: "If the agent is still running it will reconnect the next time it starts.", confirmLabel: 'Remove', danger: true })
  if (!ok) return
  await fetch(`/api/agents/${agentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  router.push('/hosts')
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center gap-4">
      <Tooltip text="Go back">
        <button
          class="size-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors"
          @click="router.back()"
        >
          <ArrowLeft
            class="size-4"
            :stroke-width="2"
          />
        </button>
      </Tooltip>
      <div class="flex-1 min-w-0">
        <!-- Inline rename -->
        <div
          v-if="renaming"
          class="flex items-center gap-2"
        >
          <input
            ref="renameInputEl"
            v-model="renameInput"
            class="text-2xl font-semibold tracking-tight bg-transparent border-b border-primary outline-none w-full max-w-xs"
            @keydown.enter="saveRename"
            @keydown.escape="cancelRename"
          >
          <Tooltip text="Save">
            <button
              class="size-7 rounded flex items-center justify-center text-green-500 hover:bg-accent transition-colors"
              @click="saveRename"
            >
              <Check
                class="size-4"
                :stroke-width="2.5"
              />
            </button>
          </Tooltip>
          <Tooltip text="Cancel">
            <button
              class="size-7 rounded flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
              @click="cancelRename"
            >
              <X
                class="size-4"
                :stroke-width="2.5"
              />
            </button>
          </Tooltip>
        </div>
        <div
          v-else
          class="flex items-center gap-2 group"
        >
          <h1 class="text-2xl font-semibold tracking-tight">
            {{ entry?.agent.displayName ?? entry?.agent.hostname ?? 'Agent' }}
          </h1>
          <Tooltip
            v-if="entry && auth.isAdmin"
            text="Rename agent"
          >
            <button
              class="size-6 rounded flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent transition-all"
              @click="startRename"
            >
              <Pencil
                class="size-3.5"
                :stroke-width="1.75"
              />
            </button>
          </Tooltip>
        </div>
        <p class="text-sm text-muted-foreground font-mono">
          {{ entry?.agent.displayName ? entry.agent.hostname + ' · ' : '' }}{{ entry?.agent.ip }}
        </p>
      </div>
      <span
        v-if="entry"
        :class="['text-xs px-2.5 py-1 rounded-full font-medium', entry.agent.status === 'online' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-amber-500/10 text-amber-600']"
      >
        {{ entry.agent.status }}
      </span>
      <Tooltip
        v-if="entry && auth.isAdmin"
        text="Remove agent"
      >
        <button
          class="size-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors shrink-0"
          @click="deleteAgent"
        >
          <Trash2
            class="size-4"
            :stroke-width="1.75"
          />
        </button>
      </Tooltip>
    </div>

    <div
      v-if="!entry"
      class="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground"
    >
      Agent not found.
    </div>

    <template v-else>
      <!-- Metrics grid -->
      <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div class="rounded-xl border border-border bg-card p-4">
          <div class="flex items-center gap-2 text-muted-foreground text-xs mb-3">
            <Cpu
              class="size-3.5"
              :stroke-width="2"
            /> CPU Usage
          </div>
          <p class="text-3xl font-bold">
            {{ metrics ? formatPercent(metrics.cpu.usage) : '—' }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            {{ metrics?.cpu.cores }} cores · {{ metrics?.cpu.model }}
          </p>
          <div
            v-if="metrics"
            class="mt-3 h-1.5 bg-muted rounded-full overflow-hidden"
          >
            <div
              class="h-full bg-primary rounded-full transition-all"
              :style="{ width: `${Math.min(metrics.cpu.usage, 100)}%` }"
            />
          </div>
        </div>

        <div class="rounded-xl border border-border bg-card p-4">
          <div class="flex items-center gap-2 text-muted-foreground text-xs mb-3">
            <MemoryStick
              class="size-3.5"
              :stroke-width="2"
            /> Memory
          </div>
          <p class="text-3xl font-bold">
            {{ metrics ? formatPercent((metrics.memory.used / metrics.memory.total) * 100) : '—' }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            {{ metrics ? `${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}` : '' }}
          </p>
          <div
            v-if="metrics"
            class="mt-3 h-1.5 bg-muted rounded-full overflow-hidden"
          >
            <div
              class="h-full bg-primary rounded-full transition-all"
              :style="{ width: `${Math.min((metrics.memory.used / metrics.memory.total) * 100, 100)}%` }"
            />
          </div>
        </div>

        <div class="rounded-xl border border-border bg-card p-4">
          <div class="flex items-center gap-2 text-muted-foreground text-xs mb-3">
            <Clock
              class="size-3.5"
              :stroke-width="2"
            /> Uptime
          </div>
          <p class="text-3xl font-bold">
            {{ metrics ? formatUptime(metrics.uptime) : '—' }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            Load: {{ metrics?.loadAverage.map(l => l.toFixed(2)).join(' · ') }}
          </p>
        </div>

        <div class="rounded-xl border border-border bg-card p-4">
          <div class="flex items-center gap-2 text-muted-foreground text-xs mb-3">
            <HardDrive
              class="size-3.5"
              :stroke-width="2"
            /> Disk
          </div>
          <template v-if="metrics?.disks[0]">
            <p class="text-3xl font-bold">
              {{ formatPercent((metrics.disks[0].used / metrics.disks[0].total) * 100) }}
            </p>
            <p class="text-xs text-muted-foreground mt-1">
              {{ formatBytes(metrics.disks[0].used) }} / {{ formatBytes(metrics.disks[0].total) }}
            </p>
            <div class="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                class="h-full bg-primary rounded-full transition-all"
                :style="{ width: `${Math.min((metrics.disks[0].used / metrics.disks[0].total) * 100, 100)}%` }"
              />
            </div>
          </template>
          <p
            v-else
            class="text-3xl font-bold"
          >
            —
          </p>
        </div>
      </div>

      <!-- Storage -->
      <div v-if="metrics?.disks.length">
        <h2 class="text-sm font-medium text-muted-foreground mb-3">
          Storage
        </h2>
        <div class="rounded-xl border border-border bg-card divide-y divide-border">
          <div
            v-for="disk in metrics.disks"
            :key="disk.mountpoint"
            class="p-4"
          >
            <div class="flex items-center justify-between text-xs mb-2">
              <span class="font-mono font-medium">{{ disk.mountpoint }}</span>
              <span class="text-muted-foreground">{{ formatBytes(disk.used) }} / {{ formatBytes(disk.total) }}</span>
            </div>
            <div class="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                class="h-full bg-primary rounded-full transition-all"
                :style="{ width: `${Math.min((disk.used / disk.total) * 100, 100)}%` }"
              />
            </div>
            <div class="flex justify-between text-xs text-muted-foreground mt-1.5">
              <span>{{ disk.filesystem }}</span>
              <span>{{ formatPercent((disk.used / disk.total) * 100) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Network -->
      <div v-if="metrics?.network.filter(n => n.interface !== 'lo').length">
        <h2 class="text-sm font-medium text-muted-foreground mb-3">
          Network
        </h2>
        <div class="rounded-xl border border-border overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-muted/40">
                <th class="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Interface
                </th>
                <th class="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  ↓ In
                </th>
                <th class="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  ↑ Out
                </th>
                <th class="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Total RX
                </th>
                <th class="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Total TX
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="iface in metrics.network.filter(n => n.interface !== 'lo')"
                :key="iface.interface"
                class="border-b border-border last:border-0"
              >
                <td class="px-4 py-3 font-mono text-xs font-medium">
                  {{ iface.interface }}
                </td>
                <td class="px-4 py-3 text-right text-xs text-muted-foreground font-mono">
                  {{ formatSpeed(iface.rxSpeed) }}
                </td>
                <td class="px-4 py-3 text-right text-xs text-muted-foreground font-mono">
                  {{ formatSpeed(iface.txSpeed) }}
                </td>
                <td class="px-4 py-3 text-right text-xs text-muted-foreground font-mono">
                  {{ formatBytes(iface.rxBytes) }}
                </td>
                <td class="px-4 py-3 text-right text-xs text-muted-foreground font-mono">
                  {{ formatBytes(iface.txBytes) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Containers -->
      <div>
        <h2 class="text-sm font-medium text-muted-foreground mb-3">
          Containers
        </h2>
        <div class="rounded-xl border border-border overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-muted/40">
                <th class="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Name
                </th>
                <th class="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Image
                </th>
                <th class="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Status
                </th>
                <th class="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  CPU
                </th>
                <th class="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Memory
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="containers.length === 0">
                <td
                  colspan="5"
                  class="px-4 py-8 text-center text-muted-foreground text-xs"
                >
                  No containers found.
                </td>
              </tr>
              <tr
                v-for="c in containers"
                :key="c.id"
                class="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                @click="router.push(`/agents/${entry?.agent.id}/containers/${c.id}`)"
              >
                <td class="px-4 py-3 font-medium font-mono text-xs">
                  {{ c.name }}
                </td>
                <td class="px-4 py-3 text-muted-foreground font-mono text-xs truncate max-w-40">
                  {{ c.image }}
                </td>
                <td class="px-4 py-3">
                  <span
                    :class="['text-xs px-2 py-0.5 rounded-full font-medium', {
                      'bg-green-500/10 text-green-600 dark:text-green-400': c.status === 'running',
                      'bg-muted text-muted-foreground': c.status === 'stopped',
                      'bg-amber-500/10 text-amber-600': c.status === 'restarting',
                      'bg-red-500/10 text-red-600': c.status === 'dead',
                    }]"
                  >{{ c.status }}</span>
                </td>
                <td class="px-4 py-3 text-right text-xs text-muted-foreground font-mono">
                  {{ formatPercent(c.cpu) }}
                </td>
                <td class="px-4 py-3 text-right text-xs text-muted-foreground font-mono">
                  {{ formatBytes(c.memory.used) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
