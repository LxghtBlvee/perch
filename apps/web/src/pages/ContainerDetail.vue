<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, RefreshCw, Cpu, MemoryStick } from 'lucide-vue-next'
import { usePerchStore } from '@/stores/perch'
import { formatBytes, formatPercent } from '@/lib/utils'

const route = useRoute()
const router = useRouter()
const store = usePerchStore()

const agentId = route.params.agentId as string
const containerId = route.params.containerId as string

const entry = computed(() => store.agents.find(a => a.agent.id === agentId))
const container = computed(() => entry.value?.containers.find(c => c.id === containerId))

const logs = ref('')
const logsLoading = ref(false)
const logsError = ref<string | null>(null)
const tail = ref(200)

async function fetchLogs() {
  logsLoading.value = true
  logsError.value = null
  try {
    const res = await fetch(`/api/agents/${agentId}/containers/${containerId}/logs?tail=${tail.value}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to fetch logs')
    logs.value = data.logs
  } catch (e: unknown) {
    logsError.value = e instanceof Error ? e.message : 'Unknown error'
  } finally {
    logsLoading.value = false
  }
}

onMounted(fetchLogs)
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <button
        class="size-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors"
        @click="router.back()"
      >
        <ArrowLeft
          class="size-4"
          :stroke-width="2"
        />
      </button>
      <div>
        <h1 class="text-2xl font-semibold tracking-tight font-mono">
          {{ container?.name ?? containerId }}
        </h1>
        <p class="text-sm text-muted-foreground font-mono mt-0.5">
          {{ container?.image }}
        </p>
      </div>
      <span
        v-if="container"
        :class="['ml-auto text-xs px-2.5 py-1 rounded-full font-medium', {
          'bg-green-500/10 text-green-600 dark:text-green-400': container.status === 'running',
          'bg-muted text-muted-foreground': container.status === 'stopped',
          'bg-amber-500/10 text-amber-600': container.status === 'restarting',
          'bg-red-500/10 text-red-600': container.status === 'dead',
        }]"
      >
        {{ container.status }}
      </span>
    </div>

    <div
      v-if="!container"
      class="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground"
    >
      Container not found.
    </div>

    <template v-else>
      <!-- Info + Resources -->
      <div class="grid grid-cols-2 gap-4">
        <div class="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 class="text-xs font-medium text-muted-foreground">
            Info
          </h2>
          <div class="space-y-2.5 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground text-xs">ID</span>
              <span class="font-mono text-xs">{{ container.id }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground text-xs">Image</span>
              <span class="font-mono text-xs truncate max-w-56">{{ container.image }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground text-xs">Created</span>
              <span class="text-xs">{{ new Date(container.createdAt).toLocaleString() }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground text-xs">State</span>
              <span class="text-xs">{{ container.state }}</span>
            </div>
          </div>
          <div
            v-if="container.ports.length"
            class="pt-3 border-t border-border space-y-1.5"
          >
            <p class="text-xs text-muted-foreground mb-2">
              Ports
            </p>
            <div
              v-for="p in container.ports"
              :key="`${p.hostPort}:${p.containerPort}`"
              class="flex justify-between text-xs font-mono"
            >
              <span class="text-muted-foreground">{{ p.containerPort }}/{{ p.protocol }}</span>
              <span v-if="p.hostPort">→ :{{ p.hostPort }}</span>
              <span
                v-else
                class="text-muted-foreground/50"
              >not published</span>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-border bg-card p-4 space-y-4">
          <h2 class="text-xs font-medium text-muted-foreground">
            Resources
          </h2>
          <div class="space-y-1">
            <div class="flex justify-between text-xs text-muted-foreground">
              <span class="flex items-center gap-1.5">
                <Cpu
                  class="size-3"
                  :stroke-width="2"
                /> CPU
              </span>
              <span>{{ formatPercent(container.cpu) }}</span>
            </div>
            <div class="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                class="h-full bg-primary rounded-full transition-all"
                :style="{ width: `${Math.min(container.cpu, 100)}%` }"
              />
            </div>
          </div>
          <div class="space-y-1">
            <div class="flex justify-between text-xs text-muted-foreground">
              <span class="flex items-center gap-1.5">
                <MemoryStick
                  class="size-3"
                  :stroke-width="2"
                /> Memory
              </span>
              <span>{{ formatBytes(container.memory.used) }} / {{ formatBytes(container.memory.limit) }}</span>
            </div>
            <div class="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                class="h-full bg-primary rounded-full transition-all"
                :style="{ width: `${container.memory.limit ? Math.min((container.memory.used / container.memory.limit) * 100, 100) : 0}%` }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Logs -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-medium text-muted-foreground">
            Logs
          </h2>
          <div class="flex items-center gap-2">
            <select
              v-model.number="tail"
              class="text-xs bg-muted border border-border rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-ring"
              @change="fetchLogs"
            >
              <option :value="100">
                Last 100 lines
              </option>
              <option :value="200">
                Last 200 lines
              </option>
              <option :value="500">
                Last 500 lines
              </option>
              <option :value="1000">
                Last 1000 lines
              </option>
            </select>
            <button
              class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
              :class="{ 'opacity-50 pointer-events-none': logsLoading }"
              @click="fetchLogs"
            >
              <RefreshCw
                class="size-3"
                :class="{ 'animate-spin': logsLoading }"
                :stroke-width="2"
              />
              Refresh
            </button>
          </div>
        </div>

        <div
          v-if="logsError"
          class="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {{ logsError }}
        </div>

        <div
          v-else
          class="rounded-xl border border-border bg-black/40 overflow-hidden"
        >
          <pre class="p-4 text-xs font-mono text-green-400/90 overflow-auto max-h-[520px] whitespace-pre-wrap break-all leading-relaxed">{{ logs || (logsLoading ? 'Loading...' : 'No logs.') }}</pre>
        </div>
      </div>
    </template>
  </div>
</template>