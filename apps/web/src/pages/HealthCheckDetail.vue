<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import Tooltip from '@/components/Tooltip.vue'
import { usePerchStore } from '@/stores/perch'
import { useApi } from '@/composables/useApi'
import { useCache } from '@/composables/useCache'

const route = useRoute()
const router = useRouter()
const store = usePerchStore()
const { apiFetch, cachedFetch } = useApi()
const { invalidate } = useCache()

const id = route.params.id as string
const check = computed(() => store.healthChecks.find(h => h.id === id))
const historyKey = `/api/health-checks/${id}/history`

type HistoryEntry = { status: 'up' | 'down'; latency: number | null; checkedAt: string }
const history = ref<HistoryEntry[]>([])
const loading = ref(true)
const hubLocation = ref<{ ip: string; city: string; country: string; countryCode: string } | null>(null)

function countryFlag(code: string): string {
  return [...code.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('')
}

async function fetchHistory(bust = false) {
  loading.value = true
  try {
    if (bust) invalidate(historyKey)
    history.value = await cachedFetch<HistoryEntry[]>(historyKey, 30_000)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchHistory()
  try {
    const res = await fetch('/api/status')
    const data = await res.json()
    if (data.location) hubLocation.value = data.location
  } catch {
    // ignore — hub location is optional
  }
})

// ─── Stats ───────────────────────────────────────────────────────────
const uptime = computed(() => {
  if (!history.value.length) return null
  return (history.value.filter(r => r.status === 'up').length / history.value.length) * 100
})

const uptimeLast24h = computed(() => {
  const cutoff = Date.now() - 86_400_000
  const recent = history.value.filter(r => new Date(r.checkedAt).getTime() > cutoff)
  if (!recent.length) return null
  return (recent.filter(r => r.status === 'up').length / recent.length) * 100
})

const avgLatency = computed(() => {
  const w = history.value.filter(r => r.latency !== null)
  if (!w.length) return null
  return Math.round(w.reduce((s, r) => s + r.latency!, 0) / w.length)
})

const minLatency = computed(() => {
  const vals = history.value.map(r => r.latency).filter((l): l is number => l !== null)
  return vals.length ? Math.min(...vals) : null
})

const maxLatency = computed(() => {
  const vals = history.value.map(r => r.latency).filter((l): l is number => l !== null)
  return vals.length ? Math.max(...vals) : null
})

// ─── Chart ───────────────────────────────────────────────────────────
const SVG_W = 744, SVG_H = 128
const CL = 0, CT = 4, CB = 4
const IW = SVG_W
const IH = SVG_H - CT - CB

const yScale = computed(() => {
  const max = maxLatency.value ?? 100
  let niceMax: number
  if (max <= 50) niceMax = 50
  else if (max <= 200) niceMax = Math.ceil(max / 50) * 50
  else if (max <= 1000) niceMax = Math.ceil(max / 250) * 250
  else niceMax = Math.ceil(max / 1000) * 1000
  const step = niceMax / 4
  return { max: niceMax, ticks: [0, step, step * 2, step * 3, niceMax] }
})

function toY(ms: number): number {
  return CT + IH - (ms / yScale.value.max) * IH
}

function toX(i: number, total: number): number {
  return CL + (i / Math.max(total - 1, 1)) * IW
}

const chartData = computed(() => {
  const pts = history.value.filter(r => r.latency !== null)
  if (pts.length < 2) return null
  return pts.map((r, i) => ({
    x: toX(i, pts.length),
    y: toY(r.latency!),
    latency: r.latency!,
    checkedAt: r.checkedAt,
  }))
})

const polyline = computed(() =>
  chartData.value?.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') ?? ''
)

const areaPath = computed(() => {
  const pts = chartData.value
  if (!pts) return ''
  const baseY = CT + IH
  return `M${pts[0].x},${baseY} ${pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} L${pts.at(-1)!.x},${baseY} Z`
})

function formatTick(ms: number): string {
  if (ms === 0) return '0'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// ─── Chart hover ─────────────────────────────────────────────────────
const svgRef = ref<SVGSVGElement | null>(null)
const hoverPoint = ref<{ x: number; y: number; latency: number; checkedAt: string } | null>(null)

function onChartMove(e: MouseEvent) {
  if (!chartData.value?.length || !svgRef.value) return
  const rect = svgRef.value.getBoundingClientRect()
  const svgX = ((e.clientX - rect.left) / rect.width) * SVG_W
  const nearest = chartData.value.reduce((p, c) =>
    Math.abs(c.x - svgX) < Math.abs(p.x - svgX) ? c : p
  )
  hoverPoint.value = nearest
}

// ─── Heartbeat ───────────────────────────────────────────────────────
type HBHover = { slot: HistoryEntry; index: number } | null
const hbHover = ref<HBHover>(null)

const heartbeatSlots = computed(() => {
  const count = 90
  const recent = history.value.slice(-count)
  return [...Array(Math.max(0, count - recent.length)).fill(null), ...recent]
})

// ─── Results table pagination ─────────────────────────────────────────
const PAGE_SIZE = 10
const page = ref(0)
const sortedHistory = computed(() => [...history.value].reverse())
const totalPages = computed(() => Math.ceil(sortedHistory.value.length / PAGE_SIZE))
const pagedHistory = computed(() =>
  sortedHistory.value.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE)
)
function prevPage() { if (page.value > 0) page.value-- }
function nextPage() { if (page.value < totalPages.value - 1) page.value++ }

// ─── Helpers ─────────────────────────────────────────────────────────
function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function pctColor(pct: number | null) {
  if (pct === null) return 'text-muted-foreground'
  if (pct === 100) return 'text-green-500'
  if (pct >= 99) return 'text-green-400'
  if (pct >= 95) return 'text-amber-500'
  return 'text-red-500'
}

function xLabel(pts: NonNullable<typeof chartData.value>, i: number): string {
  if (!pts[i]) return ''
  return new Date(pts[i].checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
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
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <span class="relative flex size-3 shrink-0">
          <span
            v-if="check?.status === 'up'"
            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"
          />
          <span
            :class="[
              'relative inline-flex rounded-full size-3',
              check?.status === 'up' ? 'bg-green-500' : check?.status === 'down' ? 'bg-red-500' : 'bg-muted-foreground',
            ]"
          />
        </span>
        <div class="min-w-0">
          <h1 class="text-2xl font-semibold tracking-tight">
            {{ check?.name ?? id }}
          </h1>
          <div class="flex items-center gap-4 mt-0.5">
            <p class="text-sm text-muted-foreground font-mono truncate">
              {{ check?.url }}
            </p>
            <span
              v-if="hubLocation"
              class="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0"
            >
              <span class="text-base leading-none">{{ countryFlag(hubLocation.countryCode) }}</span>
              <span>Pinged from {{ hubLocation.city }}, {{ hubLocation.country }}</span>
            </span>
          </div>
        </div>
      </div>
      <button
        class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
        :class="{ 'opacity-50 pointer-events-none': loading }"
        @click="fetchHistory(true)"
      >
        <RefreshCw
          class="size-3"
          :class="{ 'animate-spin': loading }"
          :stroke-width="2"
        />
        Refresh
      </button>
    </div>

    <div
      v-if="!check"
      class="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground"
    >
      Health check not found.
    </div>

    <template v-else>
      <!-- Skeleton — history loading -->
      <template v-if="loading">
        <div class="grid grid-cols-3 md:grid-cols-6 gap-4">
          <div
            v-for="i in 6"
            :key="i"
            class="rounded-xl border border-border bg-card p-4 space-y-2"
          >
            <div class="h-3 w-16 bg-muted rounded animate-pulse" />
            <div class="h-7 w-12 bg-muted rounded animate-pulse" />
            <div class="h-3 w-20 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div class="rounded-xl border border-border bg-card p-5 space-y-4">
          <div class="h-3 w-28 bg-muted rounded animate-pulse" />
          <div class="h-32 bg-muted/50 rounded-lg animate-pulse" />
        </div>
        <div class="rounded-xl border border-border bg-card p-5 space-y-3">
          <div class="h-3 w-24 bg-muted rounded animate-pulse" />
          <div class="flex gap-px h-8">
            <div
              v-for="i in 90"
              :key="i"
              class="flex-1 rounded-[2px] bg-muted animate-pulse"
            />
          </div>
        </div>
      </template>

      <!-- Real content (hidden during initial history load) -->
      <template v-else>

      <!-- Stats -->
      <div
        class="grid grid-cols-3 md:grid-cols-6 gap-4"
      >
        <div class="rounded-xl border border-border bg-card p-4">
          <p class="text-xs text-muted-foreground mb-1">
            Status
          </p>
          <p :class="['text-2xl font-bold', check.status === 'up' ? 'text-green-500' : check.status === 'down' ? 'text-red-500' : 'text-muted-foreground']">
            {{ check.status === 'up' ? 'Up' : check.status === 'down' ? 'Down' : 'Pending' }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            {{ relativeTime(check.lastChecked) }}
          </p>
        </div>
        <div class="rounded-xl border border-border bg-card p-4">
          <p class="text-xs text-muted-foreground mb-1">
            Uptime (all)
          </p>
          <p :class="['text-2xl font-bold', pctColor(uptime)]">
            {{ uptime !== null ? uptime.toFixed(2) + '%' : '—' }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            {{ history.length }} checks
          </p>
        </div>
        <div class="rounded-xl border border-border bg-card p-4">
          <p class="text-xs text-muted-foreground mb-1">
            Uptime (24h)
          </p>
          <p :class="['text-2xl font-bold', pctColor(uptimeLast24h)]">
            {{ uptimeLast24h !== null ? uptimeLast24h.toFixed(2) + '%' : '—' }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            last 24 hours
          </p>
        </div>
        <div class="rounded-xl border border-border bg-card p-4">
          <p class="text-xs text-muted-foreground mb-1">
            Avg response
          </p>
          <p class="text-2xl font-bold">
            {{ avgLatency !== null ? avgLatency + 'ms' : '—' }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            now: {{ check.latency !== null ? check.latency + 'ms' : '—' }}
          </p>
        </div>
        <div class="rounded-xl border border-border bg-card p-4">
          <p class="text-xs text-muted-foreground mb-1">
            Min / Max
          </p>
          <p class="text-2xl font-bold">
            {{ minLatency !== null ? minLatency + 'ms' : '—' }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            max {{ maxLatency !== null ? maxLatency + 'ms' : '—' }}
          </p>
        </div>
        <div class="rounded-xl border border-border bg-card p-4">
          <p class="text-xs text-muted-foreground mb-1">
            Interval
          </p>
          <p class="text-2xl font-bold">
            {{ check.interval }}s
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            every {{ check.interval >= 60 ? Math.round(check.interval / 60) + 'm' : check.interval + 's' }}
          </p>
        </div>
      </div>

      <!-- Response time chart -->
      <div class="rounded-xl border border-border bg-card p-5">
        <h2 class="text-sm font-medium text-muted-foreground mb-4">
          Response Times
        </h2>
        <div
          v-if="!chartData"
          class="flex items-center justify-center h-32 text-xs text-muted-foreground"
        >
          Not enough data yet.
        </div>
        <div
          v-else
          class="select-none"
        >
          <div class="flex gap-2 items-stretch">
            <!-- Y-axis labels (HTML, not SVG — avoids distortion with preserveAspectRatio="none") -->
            <div class="flex flex-col justify-between text-right w-12 shrink-0 text-xs text-muted-foreground font-mono py-0.5">
              <span
                v-for="tick in [...yScale.ticks].reverse()"
                :key="tick"
              >{{ formatTick(tick) }}</span>
            </div>

            <!-- Chart -->
            <div class="flex-1 relative min-w-0">
              <svg
                ref="svgRef"
                :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
                class="w-full h-32 block"
                preserveAspectRatio="none"
                @mousemove="onChartMove"
                @mouseleave="hoverPoint = null"
              >
                <!-- Gridlines -->
                <line
                  v-for="tick in yScale.ticks"
                  :key="tick"
                  x1="0"
                  :y1="toY(tick)"
                  :x2="SVG_W"
                  :y2="toY(tick)"
                  stroke="oklch(0.92 0.004 286 / 0.35)"
                  stroke-width="0.6"
                  stroke-dasharray="4 3"
                />
                <!-- Area -->
                <path
                  :d="areaPath"
                  fill="oklch(0.70 0.09 186 / 0.12)"
                />
                <!-- Line -->
                <polyline
                  :points="polyline"
                  fill="none"
                  stroke="oklch(0.70 0.09 186)"
                  stroke-width="2"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                />
                <!-- Hover vertical rule -->
                <line
                  v-if="hoverPoint"
                  :x1="hoverPoint.x"
                  y1="0"
                  :x2="hoverPoint.x"
                  :y2="SVG_H"
                  stroke="oklch(0.70 0.09 186)"
                  stroke-width="1"
                  stroke-dasharray="3 2"
                  opacity="0.5"
                />
                <!-- Hover dot -->
                <circle
                  v-if="hoverPoint"
                  :cx="hoverPoint.x"
                  :cy="hoverPoint.y"
                  r="4"
                  fill="oklch(0.70 0.09 186)"
                  stroke="oklch(0.14 0.005 285)"
                  stroke-width="2"
                />
                <!-- Mouse capture rect -->
                <rect
                  x="0"
                  y="0"
                  :width="SVG_W"
                  :height="SVG_H"
                  fill="transparent"
                />
              </svg>

              <!-- Hover tooltip -->
              <div
                v-if="hoverPoint"
                class="absolute top-2 pointer-events-none z-10 bg-card border border-border rounded-lg shadow-xl p-3 text-xs"
                :style="{
                  left: (hoverPoint.x / SVG_W) > 0.65
                    ? `calc(${(hoverPoint.x / SVG_W) * 100}% - 160px)`
                    : `calc(${(hoverPoint.x / SVG_W) * 100}% + 10px)`,
                }"
              >
                <p class="font-bold text-sm">
                  {{ hoverPoint.latency }}ms
                </p>
                <p class="text-muted-foreground mt-0.5 whitespace-nowrap">
                  {{ new Date(hoverPoint.checkedAt).toLocaleString() }}
                </p>
              </div>
            </div>
          </div>

          <!-- X labels -->
          <div class="flex gap-2 mt-1">
            <div class="w-12 shrink-0" />
            <div class="flex-1 flex justify-between text-xs text-muted-foreground">
              <span>{{ xLabel(chartData, 0) }}</span>
              <span>{{ xLabel(chartData, Math.floor(chartData.length / 2)) }}</span>
              <span>{{ xLabel(chartData, chartData.length - 1) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Heartbeat bars -->
      <div class="rounded-xl border border-border bg-card p-5">
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-sm font-medium text-muted-foreground">
            History (last 90 checks)
          </h2>
          <span :class="['text-xs font-semibold', pctColor(uptime)]">
            {{ uptime !== null ? uptime.toFixed(2) + '% uptime' : '' }}
          </span>
        </div>

        <div class="relative">
          <div class="flex gap-px items-stretch h-10">
            <div
              v-for="(slot, i) in heartbeatSlots"
              :key="i"
              class="flex-1 rounded-[2px] cursor-default transition-opacity"
              :class="{
                'bg-green-500 hover:bg-green-400': slot?.status === 'up',
                'bg-red-500 hover:bg-red-400': slot?.status === 'down',
                'bg-muted': slot === null,
              }"
              @mouseenter="slot ? (hbHover = { slot, index: i }) : null"
              @mouseleave="hbHover = null"
            />
          </div>

          <!-- Heartbeat tooltip -->
          <Transition name="fade">
            <div
              v-if="hbHover"
              class="absolute bottom-full mb-2 pointer-events-none z-10 bg-card border border-border rounded-lg shadow-xl p-2.5 text-xs"
              :style="{
                left: `${(hbHover.index / heartbeatSlots.length) * 100}%`,
                transform: (hbHover.index / heartbeatSlots.length) > 0.7
                  ? 'translateX(-100%)'
                  : (hbHover.index / heartbeatSlots.length) > 0.3
                    ? 'translateX(-50%)'
                    : 'none',
              }"
            >
              <div class="flex items-center gap-1.5 mb-1">
                <span
                  :class="['size-1.5 rounded-full shrink-0', hbHover.slot.status === 'up' ? 'bg-green-500' : 'bg-red-500']"
                />
                <span :class="['font-semibold', hbHover.slot.status === 'up' ? 'text-green-500' : 'text-red-500']">
                  {{ hbHover.slot.status === 'up' ? 'Up' : 'Down' }}
                </span>
                <span
                  v-if="hbHover.slot.latency"
                  class="text-muted-foreground ml-auto pl-4"
                >{{ hbHover.slot.latency }}ms</span>
              </div>
              <p class="text-muted-foreground whitespace-nowrap">
                {{ new Date(hbHover.slot.checkedAt).toLocaleString() }}
              </p>
            </div>
          </Transition>
        </div>

        <div class="flex justify-between text-xs text-muted-foreground mt-2">
          <span>90 checks ago</span>
          <span>now</span>
        </div>
      </div>

      <!-- Results table -->
      <div class="rounded-xl border border-border overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-muted/40">
              <th class="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                Time
              </th>
              <th class="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                Status
              </th>
              <th class="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                Latency
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!history.length">
              <td
                colspan="3"
                class="px-4 py-8 text-center text-xs text-muted-foreground"
              >
                No results yet.
              </td>
            </tr>
            <tr
              v-for="result in pagedHistory"
              :key="result.checkedAt"
              class="border-b border-border last:border-0"
            >
              <td class="px-4 py-2.5 text-xs text-muted-foreground">
                {{ new Date(result.checkedAt).toLocaleString() }}
              </td>
              <td class="px-4 py-2.5">
                <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', result.status === 'up' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-500']">
                  {{ result.status }}
                </span>
              </td>
              <td class="px-4 py-2.5 text-right text-xs font-mono text-muted-foreground">
                {{ result.latency !== null ? result.latency + 'ms' : '—' }}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div
          v-if="totalPages > 1"
          class="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20"
        >
          <span class="text-xs text-muted-foreground">
            {{ page * PAGE_SIZE + 1 }}–{{ Math.min((page + 1) * PAGE_SIZE, sortedHistory.length) }} of {{ sortedHistory.length }}
          </span>
          <div class="flex items-center gap-1">
            <Tooltip
              text="Previous page"
              side="top"
            >
              <button
                class="size-7 rounded-md flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
                :disabled="page === 0"
                @click="prevPage"
              >
                <ChevronLeft
                  class="size-4 text-muted-foreground"
                  :stroke-width="1.75"
                />
              </button>
            </Tooltip>
            <span class="text-xs text-muted-foreground px-1">{{ page + 1 }} / {{ totalPages }}</span>
            <Tooltip
              text="Next page"
              side="top"
            >
              <button
                class="size-7 rounded-md flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
                :disabled="page === totalPages - 1"
                @click="nextPage"
              >
                <ChevronRight
                  class="size-4 text-muted-foreground"
                  :stroke-width="1.75"
                />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      </template><!-- end v-else (real content) -->
    </template><!-- end v-else (check exists) -->
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.1s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
