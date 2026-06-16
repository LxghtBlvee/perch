<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus, Trash2, HeartPulse } from 'lucide-vue-next'
import Tooltip from '@/components/Tooltip.vue'
import { usePerchStore } from '@/stores/perch'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'

const store = usePerchStore()
const auth = useAuthStore()
const router = useRouter()
const { apiFetch } = useApi()

// Track per-check history loading so we can show shimmer bars
const historyLoading = ref<Record<string, boolean>>({})

const showForm = ref(false)
const form = ref({ name: '', url: '', interval: 60 })

type HistoryEntry = { status: 'up' | 'down'; latency: number | null; checkedAt: string }
const history = ref<Record<string, HistoryEntry[]>>({})

async function loadHistory(id: string) {
  historyLoading.value[id] = true
  try {
    const res = await apiFetch(`/api/health-checks/${id}/history`)
    history.value[id] = await res.json()
  } catch {
    history.value[id] = []
  } finally {
    historyLoading.value[id] = false
  }
}

// Load history for any check that appears (handles both initial load and new checks)
watch(
  () => store.healthChecks,
  (checks) => {
    for (const check of checks) {
      if (!(check.id in history.value)) {
        history.value[check.id] = []
        loadHistory(check.id)
      }
    }
  },
  { immediate: true }
)

// Append to history when a live WebSocket update arrives
watch(
  () => store.healthChecks.map(h => h.lastChecked),
  (newTimes, oldTimes) => {
    if (!oldTimes) return
    store.healthChecks.forEach((check, i) => {
      if (newTimes[i] !== oldTimes[i] && check.lastChecked && check.status !== 'pending') {
        const h = history.value[check.id]
        if (!h || h.at(-1)?.checkedAt === check.lastChecked) return
        h.push({ status: check.status as 'up' | 'down', latency: check.latency, checkedAt: check.lastChecked })
      }
    })
  }
)

function heartbeatSlots(id: string, count = 60): (HistoryEntry | null)[] {
  const results = history.value[id] ?? []
  const recent = results.slice(-count)
  return [...Array(Math.max(0, count - recent.length)).fill(null), ...recent]
}

function uptime(id: string): string {
  const results = history.value[id]
  if (!results?.length) return '—'
  const pct = (results.filter(r => r.status === 'up').length / results.length) * 100
  return `${pct.toFixed(2)}%`
}

function avgLatency(id: string): string {
  const results = (history.value[id] ?? []).filter(r => r.latency !== null)
  if (!results.length) return '—'
  const avg = results.reduce((s, r) => s + (r.latency ?? 0), 0) / results.length
  return `${Math.round(avg)}ms`
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

async function createCheck() {
  if (!form.value.name || !form.value.url) return
  const res = await apiFetch('/api/health-checks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form.value),
  })
  const check = await res.json()
  store.healthChecks.push(check)
  history.value[check.id] = []
  form.value = { name: '', url: '', interval: 60 }
  showForm.value = false
}

async function deleteCheck(id: string) {
  // Optimistic: remove immediately, restore on error
  const prevChecks = [...store.healthChecks]
  const prevHistory = { ...history.value }
  store.healthChecks = store.healthChecks.filter(h => h.id !== id)
  delete history.value[id]
  try {
    const res = await apiFetch(`/api/health-checks/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error()
  } catch {
    store.healthChecks = prevChecks
    history.value = prevHistory
  }
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          Health Checks
        </h1>
        <p class="text-sm text-muted-foreground mt-1">
          Monitor HTTP endpoints.
        </p>
      </div>
      <button
        class="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
        @click="showForm = !showForm"
      >
        <Plus
          class="size-4"
          :stroke-width="2"
        />
        Add check
      </button>
    </div>

    <!-- Add form -->
    <div
      v-if="showForm"
      class="rounded-xl border border-border bg-card p-5 space-y-4"
    >
      <h3 class="text-sm font-medium">
        New health check
      </h3>
      <div class="grid grid-cols-3 gap-3">
        <div class="space-y-1.5">
          <label class="text-xs text-muted-foreground">Name</label>
          <input
            v-model="form.name"
            placeholder="My API"
            class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
        </div>
        <div class="space-y-1.5">
          <label class="text-xs text-muted-foreground">URL</label>
          <input
            v-model="form.url"
            placeholder="https://example.com/health"
            class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
        </div>
        <div class="space-y-1.5">
          <label class="text-xs text-muted-foreground">Interval (seconds)</label>
          <input
            v-model.number="form.interval"
            type="number"
            min="10"
            class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
        </div>
      </div>
      <div class="flex gap-2">
        <button
          class="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          @click="createCheck"
        >
          Save
        </button>
        <button
          class="px-3 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
          @click="showForm = false"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Pre-connection skeleton -->
    <div
      v-if="!store.connected"
      class="space-y-3"
    >
      <div
        v-for="i in 3"
        :key="i"
        class="rounded-xl border border-border bg-card p-5 space-y-4"
      >
        <div class="flex items-center gap-3">
          <div class="size-2.5 rounded-full bg-muted animate-pulse shrink-0" />
          <div class="flex-1 space-y-1.5">
            <div class="h-3.5 w-32 bg-muted rounded animate-pulse" />
            <div class="h-3 w-48 bg-muted rounded animate-pulse" />
          </div>
          <div class="flex gap-6">
            <div class="space-y-1.5 text-right">
              <div class="h-3 w-10 bg-muted rounded animate-pulse ml-auto" />
              <div class="h-3.5 w-14 bg-muted rounded animate-pulse" />
            </div>
            <div class="space-y-1.5 text-right">
              <div class="h-3 w-12 bg-muted rounded animate-pulse ml-auto" />
              <div class="h-3.5 w-10 bg-muted rounded animate-pulse" />
            </div>
          </div>
          <div class="size-8 rounded-lg bg-muted animate-pulse" />
        </div>
        <div class="flex gap-px h-8">
          <div
            v-for="j in 60"
            :key="j"
            class="flex-1 rounded-[2px] bg-muted animate-pulse"
          />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="store.healthChecks.length === 0 && !showForm"
      class="rounded-xl border border-dashed border-border p-16 flex flex-col items-center gap-4 text-center"
    >
      <HeartPulse
        class="size-10 text-muted-foreground/30"
        :stroke-width="1.25"
      />
      <div>
        <p class="text-sm font-medium text-muted-foreground">
          No health checks yet
        </p>
        <p class="text-xs text-muted-foreground/60 mt-1">
          Monitor HTTP endpoints and get alerted when they go down.
        </p>
      </div>
      <button
        v-if="auth.isAdmin"
        class="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
        @click="showForm = true"
      >
        <Plus
          class="size-4"
          :stroke-width="2"
        />
        Add your first check
      </button>
    </div>

    <!-- Checks -->
    <div
      v-else
      class="space-y-3"
    >
      <div
        v-for="check in store.healthChecks"
        :key="check.id"
        class="rounded-xl border border-border bg-card p-5 cursor-pointer hover:border-primary/30 transition-colors"
        @click="router.push(`/health-checks/${check.id}`)"
      >
        <!-- Top row: status + name + stats + delete -->
        <div class="flex items-center gap-3 mb-4">
          <!-- Status dot -->
          <span class="relative flex size-2.5 shrink-0">
            <span
              v-if="check.status === 'up'"
              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"
            />
            <span
              :class="[
                'relative inline-flex rounded-full size-2.5',
                check.status === 'up' ? 'bg-green-500' : check.status === 'down' ? 'bg-red-500' : 'bg-muted-foreground'
              ]"
            />
          </span>

          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm">
              {{ check.name }}
            </p>
            <p class="text-xs text-muted-foreground font-mono truncate">
              {{ check.url }}
            </p>
          </div>

          <!-- Stats -->
          <div class="flex items-center gap-6 text-xs shrink-0">
            <div class="text-right">
              <p class="text-muted-foreground">
                Uptime
              </p>
              <p
                :class="[
                  'font-semibold',
                  uptime(check.id) === '100.00%' ? 'text-green-500' : uptime(check.id) === '—' ? 'text-muted-foreground' : 'text-amber-500'
                ]"
              >
                {{ uptime(check.id) }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-muted-foreground">
                Avg resp.
              </p>
              <p class="font-semibold">
                {{ avgLatency(check.id) }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-muted-foreground">
                Interval
              </p>
              <p class="font-semibold">
                {{ check.interval }}s
              </p>
            </div>
          </div>

          <Tooltip text="Delete check">
            <button
              v-if="auth.isAdmin"
              class="size-8 rounded-lg border border-border flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors ml-1"
              @click.stop="deleteCheck(check.id)"
            >
              <Trash2
                class="size-3.5"
                :stroke-width="2"
              />
            </button>
          </Tooltip>
        </div>

        <!-- Heartbeat bars -->
        <div class="flex gap-px items-stretch h-8">
          <div
            v-for="(slot, i) in heartbeatSlots(check.id)"
            :key="i"
            class="flex-1 rounded-[2px] transition-opacity hover:opacity-70"
            :class="{
              'bg-green-500': slot?.status === 'up',
              'bg-red-500': slot?.status === 'down',
              'bg-muted': slot === null,
              'animate-pulse': historyLoading[check.id],
            }"
            :title="slot
              ? `${slot.status === 'up' ? 'Up' : 'Down'} · ${slot.latency != null ? slot.latency + 'ms' : 'N/A'} · ${new Date(slot.checkedAt).toLocaleString()}`
              : 'No data'"
          />
        </div>

        <!-- Footer -->
        <div class="flex justify-between text-xs text-muted-foreground mt-2">
          <span>{{ history[check.id]?.length ? `${history[check.id].length} checks recorded` : 'Waiting for first check...' }}</span>
          <span>Last checked {{ relativeTime(check.lastChecked) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
