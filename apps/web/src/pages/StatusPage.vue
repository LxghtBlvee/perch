<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const slug = route.params.slug as string

type DisplayMode = 'full_history' | 'response_time' | 'current_status'
type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'scheduled' | 'in_progress' | 'completed'

interface Theme {
  accentColor?: string
  bgColor?: string
  textColor?: string
  fontFamily?: string
  customCss?: string
}

interface CheckResult { status: string; latency: number | null; checkedAt: string }
interface PageCheck {
  id: string
  displayName: string
  displayMode: DisplayMode
  url: string | null
  current: CheckResult | null
  history: CheckResult[]
}

interface Incident {
  id: string
  type: 'incident' | 'maintenance'
  title: string
  body: string
  status: IncidentStatus
  scheduledAt: string | null
  createdAt: string
  updatedAt: string
}

interface PageData {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  themeJson: string | null
  checks: PageCheck[]
  incidents: Incident[]
}

const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  investigating: 'Investigating',
  identified: 'Identified',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
}

const INCIDENT_BANNER_COLOR: Record<'incident' | 'maintenance', string> = {
  incident: 'border-red-500/30 bg-red-500/5',
  maintenance: 'border-sky-500/30 bg-sky-500/5',
}

const INCIDENT_STATUS_COLOR: Record<IncidentStatus, string> = {
  investigating: 'text-red-500',
  identified: 'text-amber-500',
  monitoring: 'text-blue-500',
  resolved: 'text-green-500',
  scheduled: 'text-sky-500',
  in_progress: 'text-amber-500',
  completed: 'text-green-500',
}

const data = ref<PageData | null>(null)
const loading = ref(true)
const error = ref('')

const FONT_FAMILY_MAP: Record<string, string> = {
  inter: "'Inter', sans-serif",
  'dm-sans': "'DM Sans', sans-serif",
  geist: "'Geist', sans-serif",
  jakarta: "'Plus Jakarta Sans', sans-serif",
  mono: "'JetBrains Mono', monospace",
}

const FONT_GOOGLE_MAP: Record<string, string> = {
  inter: 'Inter:wght@400;500;600;700',
  'dm-sans': 'DM+Sans:wght@400;500;600;700',
  geist: 'Geist:wght@400;500;600;700',
  jakarta: 'Plus+Jakarta+Sans:wght@400;500;600;700',
  mono: 'JetBrains+Mono:wght@400;500;600;700',
}

function applyTheme(themeStr: string | null) {
  // Remove any previously injected theme style/font
  document.getElementById('sp-theme')?.remove()
  document.getElementById('sp-font')?.remove()

  if (!themeStr) return

  let theme: Theme
  try { theme = JSON.parse(themeStr) } catch { return }

  const vars: string[] = []

  if (theme.accentColor) {
    vars.push(`--primary: ${theme.accentColor};`)
    vars.push(`--color-primary: ${theme.accentColor};`)
    vars.push(`--ring: ${theme.accentColor};`)
  }
  if (theme.bgColor) {
    vars.push(`--background: ${theme.bgColor};`)
    vars.push(`--color-background: ${theme.bgColor};`)
    vars.push(`background-color: ${theme.bgColor} !important;`)
  }
  if (theme.textColor) {
    vars.push(`--foreground: ${theme.textColor};`)
    vars.push(`--color-foreground: ${theme.textColor};`)
    vars.push(`color: ${theme.textColor} !important;`)
  }
  if (theme.fontFamily && theme.fontFamily !== 'system') {
    const ff = FONT_FAMILY_MAP[theme.fontFamily]
    if (ff) {
      vars.push(`font-family: ${ff} !important;`)
      const query = FONT_GOOGLE_MAP[theme.fontFamily]
      if (query) {
        const link = document.createElement('link')
        link.id = 'sp-font'
        link.rel = 'stylesheet'
        link.href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`
        document.head.appendChild(link)
      }
    }
  }

  let css = `#sp-root { ${vars.join(' ')} }\n#sp-root * { font-family: inherit; }`
  if (theme.customCss) css += `\n${theme.customCss}`

  const style = document.createElement('style')
  style.id = 'sp-theme'
  style.textContent = css
  document.head.appendChild(style)
}

onMounted(async () => {
  const res = await fetch(`/api/status/${slug}`, {
    headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
  })
  if (res.ok) {
    data.value = await res.json() as PageData
    applyTheme(data.value.themeJson ?? null)
  } else if (res.status === 404) {
    error.value = 'Status page not found.'
  } else if (res.status === 401) {
    error.value = 'This status page requires sign-in.'
  } else {
    error.value = 'Failed to load status page.'
  }
  loading.value = false
})

onUnmounted(() => {
  document.getElementById('sp-theme')?.remove()
  document.getElementById('sp-font')?.remove()
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
  <div id="sp-root" class="min-h-screen bg-background text-foreground">
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
        <div v-if="data" class="flex items-center gap-3">
          <img v-if="data.logoUrl" :src="data.logoUrl" alt="" class="h-6 max-w-24 object-contain">
          <span class="text-sm font-medium text-muted-foreground">{{ data.name }}</span>
        </div>
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
        <!-- Description -->
        <p v-if="data.description" class="text-sm text-muted-foreground -mt-4">{{ data.description }}</p>

        <!-- Overall status banner -->
        <div class="rounded-xl border border-border bg-card p-6 flex items-center gap-4">
          <div :class="['size-3 rounded-full shrink-0', overallColor[overallStatus]]" />
          <p :class="['text-base font-semibold', overallTextColor[overallStatus]]">
            {{ overallLabel[overallStatus] }}
          </p>
        </div>

        <!-- Active incidents / maintenance banners -->
        <div v-if="data.incidents && data.incidents.length > 0" class="space-y-3">
          <div
            v-for="incident in data.incidents"
            :key="incident.id"
            :class="['rounded-xl border p-4 space-y-1', INCIDENT_BANNER_COLOR[incident.type]]"
          >
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide" :class="incident.type === 'maintenance' ? 'text-sky-500' : 'text-red-500'">
                {{ incident.type === 'maintenance' ? 'Maintenance' : 'Incident' }}
              </span>
              <span class="text-xs text-muted-foreground">·</span>
              <span class="text-xs font-medium" :class="INCIDENT_STATUS_COLOR[incident.status]">
                {{ INCIDENT_STATUS_LABEL[incident.status] }}
              </span>
              <span v-if="incident.scheduledAt" class="text-xs text-muted-foreground ml-auto">{{ new Date(incident.scheduledAt).toLocaleString() }}</span>
            </div>
            <p class="text-sm font-medium">{{ incident.title }}</p>
            <p v-if="incident.body" class="text-xs text-muted-foreground">{{ incident.body }}</p>
            <p class="text-xs text-muted-foreground">{{ new Date(incident.updatedAt).toLocaleString() }}</p>
          </div>
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