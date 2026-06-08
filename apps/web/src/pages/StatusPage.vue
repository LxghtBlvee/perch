<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const slug = route.params.slug as string

type DisplayMode = 'full_history' | 'response_time' | 'current_status'

interface CheckResult { status: string; latency: number | null; checkedAt: string }
interface PageCheck {
  id: string
  displayName: string
  displayMode: DisplayMode
  url: string | null
  current: CheckResult | null
  history: CheckResult[]
}

interface PageData {
  id: string
  name: string
  slug: string
  checks: PageCheck[]
}

const data = ref<PageData | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  const res = await fetch(`/api/status/${slug}`, {
    headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
  })
  if (res.ok) {
    data.value = await res.json() as PageData
  } else if (res.status === 404) {
    error.value = 'Status page not found.'
  } else if (res.status === 401) {
    error.value = 'This status page requires sign-in.'
  } else {
    error.value = 'Failed to load status page.'
  }
  loading.value = false
})

const overallStatus = computed(() => {
  if (!data.value || data.value.checks.length === 0) return 'unknown'
  const statuses = data.value.checks.map(c => c.current?.status)
  if (statuses.every(s => s === 'up')) return 'operational'
  if (statuses.every(s => s === 'down')) return 'outage'
  return 'degraded'
})

const overallLabel: Record<string, string> = {
  operational: 'All systems operational',
  degraded: 'Some systems degraded',
  outage: 'Major outage',
  unknown: 'No data',
}

const overallColor: Record<string, string> = {
  operational: 'bg-green-500',
  degraded: 'bg-amber-500',
  outage: 'bg-red-500',
  unknown: 'bg-muted-foreground',
}

const overallTextColor: Record<string, string> = {
  operational: 'text-green-500',
  degraded: 'text-amber-500',
  outage: 'text-red-500',
  unknown: 'text-muted-foreground',
}

function uptime(history: CheckResult[]) {
  if (history.length === 0) return null
  const up = history.filter(r => r.status === 'up').length
  return ((up / history.length) * 100).toFixed(2)
}

// Build SVG path for response time chart
function buildChart(history: CheckResult[], width: number, height: number): string {
  const latencies = history.map(r => r.latency ?? 0).reverse()
  if (latencies.length < 2) return ''
  const max = Math.max(...latencies, 1)
  const points = latencies.map((l, i) => {
    const x = (i / (latencies.length - 1)) * width
    const y = height - (l / max) * height
    return `${x},${y}`
  })
  return `M ${points.join(' L ')}`
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- Header -->
    <header class="border-b border-border">
      <div class="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            fill="none"
            class="size-6 text-primary"
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
          <span class="text-sm font-semibold tracking-tight">Perch</span>
        </div>
        <span
          v-if="data"
          class="text-sm font-medium text-muted-foreground"
        >{{ data.name }}</span>
      </div>
    </header>

    <main class="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <!-- Loading -->
      <div
        v-if="loading"
        class="text-sm text-muted-foreground"
      >
        Loading...
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="rounded-xl border border-border bg-card p-8 text-center"
      >
        <p class="text-sm text-muted-foreground">
          {{ error }}
        </p>
      </div>

      <template v-else-if="data">
        <!-- Overall status banner -->
        <div class="rounded-xl border border-border bg-card p-6 flex items-center gap-4">
          <div :class="['size-3 rounded-full shrink-0', overallColor[overallStatus]]" />
          <p :class="['text-base font-semibold', overallTextColor[overallStatus]]">
            {{ overallLabel[overallStatus] }}
          </p>
        </div>

        <!-- Check cards -->
        <div class="space-y-3">
          <div
            v-for="check in data.checks"
            :key="check.id"
            class="rounded-xl border border-border bg-card p-5 space-y-4"
          >
            <!-- Check header -->
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-medium">
                  {{ check.displayName }}
                </p>
                <p
                  v-if="check.url"
                  class="text-xs text-muted-foreground font-mono mt-0.5"
                >
                  {{ check.url }}
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span
                  v-if="check.current?.latency"
                  class="text-xs text-muted-foreground"
                >{{ check.current.latency }}ms</span>
                <div
                  :class="[
                    'size-2.5 rounded-full',
                    check.current?.status === 'up' ? 'bg-green-500' :
                    check.current?.status === 'down' ? 'bg-red-500' :
                    'bg-muted-foreground'
                  ]"
                />
                <span
                  :class="[
                    'text-xs font-medium capitalize',
                    check.current?.status === 'up' ? 'text-green-500' :
                    check.current?.status === 'down' ? 'text-red-500' :
                    'text-muted-foreground'
                  ]"
                >
                  {{ check.current?.status ?? 'No data' }}
                </span>
              </div>
            </div>

            <!-- Full history: heartbeat bars + uptime % -->
            <template v-if="check.displayMode === 'full_history' && check.history.length > 0">
              <div class="space-y-1.5">
                <div class="flex gap-px h-8">
                  <div
                    v-for="(r, i) in [...check.history].reverse()"
                    :key="i"
                    :class="['flex-1 rounded-sm', r.status === 'up' ? 'bg-green-500' : 'bg-red-500']"
                    :title="`${r.status} — ${new Date(r.checkedAt).toLocaleString()}`"
                  />
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs text-muted-foreground">{{ check.history.length }} checks</span>
                  <span class="text-xs font-medium">{{ uptime(check.history) }}% uptime</span>
                </div>
              </div>
            </template>

            <!-- Response time: SVG line chart -->
            <template v-else-if="check.displayMode === 'response_time' && check.history.length >= 2">
              <div class="space-y-1">
                <svg
                  viewBox="0 0 400 60"
                  class="w-full h-14"
                  preserveAspectRatio="none"
                >
                  <path
                    :d="buildChart(check.history, 400, 60)"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    class="text-primary"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <div class="flex items-center justify-between">
                  <span class="text-xs text-muted-foreground">Response time</span>
                  <span
                    v-if="check.history[0]?.latency != null"
                    class="text-xs font-medium"
                  >{{ check.history[0].latency }}ms latest</span>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Footer -->
        <p class="text-center text-xs text-muted-foreground">
          Powered by <a
            href="https://github.com/LxghtBlvee/perch"
            target="_blank"
            class="hover:text-foreground transition-colors"
          >Perch</a>
        </p>
      </template>
    </main>
  </div>
</template>