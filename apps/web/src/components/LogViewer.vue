<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { Search, RefreshCw, WrapText, Clock } from 'lucide-vue-next'
import { parseLogs, type LogLevel, type ParsedLogLine } from '@/lib/logs'

const props = defineProps<{
  lines: string
  loading: boolean
  error: string | null
  tail: number
}>()

const emit = defineEmits<{
  refresh: []
  'update:tail': [number]
}>()

// Per-level presentation. Static class strings so Tailwind keeps them.
const LEVEL_META: Record<LogLevel, { label: string; badge: string; border: string }> = {
  error: { label: 'ERROR', badge: 'bg-red-500/15 text-red-600 dark:text-red-400', border: 'border-l-red-500' },
  fatal: { label: 'FATAL', badge: 'bg-red-600/20 text-red-700 dark:text-red-300', border: 'border-l-red-600' },
  warn: { label: 'WARN', badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', border: 'border-l-amber-500' },
  info: { label: 'INFO', badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', border: 'border-l-sky-500' },
  debug: { label: 'DEBUG', badge: 'bg-violet-500/15 text-violet-600 dark:text-violet-400', border: 'border-l-violet-500' },
  trace: { label: 'TRACE', badge: 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400', border: 'border-l-zinc-500' },
  unknown: { label: '·', badge: 'text-muted-foreground', border: 'border-l-transparent' },
}

const VALUE_CLASS: Record<string, string> = {
  number: 'text-amber-600 dark:text-amber-300',
  boolean: 'text-violet-600 dark:text-violet-300',
  null: 'text-muted-foreground italic',
  string: 'text-foreground/80',
}

const search = ref('')
const wrap = ref(true)
const showTimestamps = ref(true)
// Levels the user has toggled off.
const hidden = reactive(new Set<LogLevel>())

const parsed = computed<ParsedLogLine[]>(() => parseLogs(props.lines))

const counts = computed(() => {
  const c = {} as Record<LogLevel, number>
  for (const l of parsed.value) c[l.level] = (c[l.level] ?? 0) + 1
  return c
})

// Only show chips for levels actually present, in severity order.
const LEVEL_ORDER: LogLevel[] = ['error', 'fatal', 'warn', 'info', 'debug', 'trace', 'unknown']
const presentLevels = computed(() => LEVEL_ORDER.filter(l => counts.value[l]))

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return parsed.value.filter(l =>
    !hidden.has(l.level) && (q === '' || l.raw.toLowerCase().includes(q)),
  )
})

const anyTimestamp = computed(() => parsed.value.some(l => l.timestamp))

function toggleLevel(level: LogLevel) {
  if (hidden.has(level)) hidden.delete(level)
  else hidden.add(level)
}

const TAIL_OPTIONS = [100, 200, 500, 1000]
</script>

<template>
  <div class="rounded-xl border border-border bg-card overflow-hidden">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2 p-2.5 border-b border-border">
      <div class="relative flex-1 min-w-44">
        <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <input
          v-model="search"
          type="text"
          placeholder="Filter logs…"
          class="w-full text-xs bg-muted/50 border border-border rounded-lg pl-8 pr-2 py-1.5 outline-none focus:ring-2 focus:ring-ring"
        >
      </div>

      <!-- Level filter chips -->
      <div class="flex items-center gap-1">
        <button
          v-for="level in presentLevels"
          :key="level"
          :class="[
            'text-[11px] font-medium px-2 py-1 rounded-md transition-colors tabular-nums',
            hidden.has(level) ? 'opacity-40 bg-muted/40' : LEVEL_META[level].badge,
          ]"
          :title="hidden.has(level) ? `Show ${level}` : `Hide ${level}`"
          @click="toggleLevel(level)"
        >
          {{ LEVEL_META[level].label }} {{ counts[level] }}
        </button>
      </div>

      <div class="h-5 w-px bg-border mx-0.5" />

      <button
        :class="['size-7 flex items-center justify-center rounded-lg border transition-colors',
                 wrap ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:bg-accent text-muted-foreground']"
        title="Toggle line wrapping"
        @click="wrap = !wrap"
      >
        <WrapText class="size-3.5" />
      </button>
      <button
        v-if="anyTimestamp"
        :class="['size-7 flex items-center justify-center rounded-lg border transition-colors',
                 showTimestamps ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:bg-accent text-muted-foreground']"
        title="Toggle timestamps"
        @click="showTimestamps = !showTimestamps"
      >
        <Clock class="size-3.5" />
      </button>

      <select
        :value="tail"
        class="text-xs bg-muted/50 border border-border rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-ring"
        @change="emit('update:tail', Number(($event.target as HTMLSelectElement).value))"
      >
        <option
          v-for="opt in TAIL_OPTIONS"
          :key="opt"
          :value="opt"
        >
          Last {{ opt }} lines
        </option>
      </select>
      <button
        class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
        :class="{ 'opacity-50 pointer-events-none': loading }"
        @click="emit('refresh')"
      >
        <RefreshCw
          class="size-3"
          :class="{ 'animate-spin': loading }"
        />
        Refresh
      </button>
    </div>

    <!-- Body -->
    <div
      v-if="error"
      class="p-4 text-sm text-destructive"
    >
      {{ error }}
    </div>

    <div
      v-else-if="loading && !parsed.length"
      class="p-4 space-y-2 max-h-[520px] overflow-hidden"
    >
      <div
        v-for="i in 18"
        :key="i"
        class="h-3 rounded animate-pulse bg-muted-foreground/10"
        :style="{ width: `${45 + (i * 37) % 55}%` }"
      />
    </div>

    <div
      v-else-if="!visible.length"
      class="p-8 text-center text-sm text-muted-foreground"
    >
      {{ parsed.length ? 'No logs match the current filters.' : 'No logs.' }}
    </div>

    <div
      v-else
      class="overflow-auto max-h-[520px] font-mono text-xs leading-relaxed"
    >
      <div
        v-for="line in visible"
        :key="line.id"
        :class="['group flex gap-2 px-3 py-0.5 border-l-2 hover:bg-muted/40', LEVEL_META[line.level].border]"
      >
        <span
          v-if="showTimestamps && anyTimestamp"
          class="shrink-0 text-muted-foreground/60 select-none w-44 truncate"
        >{{ line.timestamp ?? '' }}</span>

        <span
          :class="['shrink-0 inline-block w-12 text-center rounded text-[10px] font-semibold leading-5 select-none', LEVEL_META[line.level].badge]"
        >{{ LEVEL_META[line.level].label }}</span>

        <span
          :class="['flex-1 min-w-0', wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto']"
        >
          <span
            v-if="line.message"
            class="text-foreground/90"
          >{{ line.message }}</span>
          <template v-if="line.fields.length">
            <span
              v-for="(f, i) in line.fields"
              :key="i"
              class="ml-2"
            ><span class="text-sky-700 dark:text-sky-300/80">{{ f.key }}</span><span class="text-muted-foreground">=</span><span :class="VALUE_CLASS[f.type]">{{ f.value }}</span></span>
          </template>
          <span
            v-if="!line.message && !line.fields.length"
            class="text-foreground/40"
          >&nbsp;</span>
        </span>
      </div>
    </div>
  </div>
</template>
