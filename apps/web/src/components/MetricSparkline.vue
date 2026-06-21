<script setup lang="ts">
import { ref, computed } from 'vue'
import { formatDateTime } from '@/composables/useUserPrefs'

interface Series {
  label: string
  /** Tailwind text-* class; line/area/dot all derive from currentColor. */
  colorClass: string
  values: number[]
}

const props = withDefaults(defineProps<{
  series: Series[]
  timestamps: string[]
  max: number
  format: (v: number) => string
  height?: number
}>(), {
  height: 64,
})

const SW = 400
const SH = 64

const wrap = ref<HTMLElement | null>(null)
const hover = ref<number | null>(null)
// Cursor position in viewport coords, for the teleported (un-clipped) tooltip.
const mouseX = ref(0)
const mouseY = ref(0)

const n = computed(() => props.timestamps.length)

function x(i: number) {
  return (i / Math.max(n.value - 1, 1)) * SW
}
function y(v: number) {
  return SH - (Math.min(Math.max(v, 0), props.max) / props.max) * SH
}

function line(values: number[]) {
  return values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
}
function area(values: number[]) {
  if (!values.length) return ''
  return `M${x(0)},${SH} ${values.map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} L${x(values.length - 1)},${SH} Z`
}

// Percent positions for the HTML hover overlay (avoids SVG x/y scale distortion).
function leftPct(i: number) {
  return `${(i / Math.max(n.value - 1, 1)) * 100}%`
}
function topPct(v: number) {
  return `${(1 - Math.min(Math.max(v, 0), props.max) / props.max) * 100}%`
}

function onMove(e: MouseEvent) {
  const el = wrap.value
  if (!el || n.value < 2) return
  const rect = el.getBoundingClientRect()
  const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
  hover.value = Math.round(ratio * (n.value - 1))
  mouseX.value = e.clientX
  mouseY.value = e.clientY
}
function onLeave() {
  hover.value = null
}

// Keep the tooltip from running off the left/right of the viewport.
const tooltipAlign = computed(() => {
  if (mouseX.value < 100) return 'left'
  if (mouseX.value > window.innerWidth - 100) return 'right'
  return 'center'
})
</script>

<template>
  <div
    ref="wrap"
    class="relative"
    :style="{ height: `${height}px` }"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <svg
      :viewBox="`0 0 ${SW} ${SH}`"
      class="w-full block"
      :style="{ height: `${height}px` }"
      preserveAspectRatio="none"
    >
      <line
        v-for="gy in [SH * 0.25, SH * 0.5, SH * 0.75]"
        :key="gy"
        x1="0"
        :y1="gy"
        :x2="SW"
        :y2="gy"
        stroke="currentColor"
        class="text-border"
        stroke-width="0.5"
      />
      <path
        :class="series[0].colorClass"
        :d="area(series[0].values)"
        fill="currentColor"
        fill-opacity="0.15"
      />
      <polyline
        v-for="s in series"
        :key="s.label"
        :class="s.colorClass"
        :points="line(s.values)"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>

    <!-- Hover overlay (HTML, so dots stay round despite the stretched SVG) -->
    <template v-if="hover !== null && n > 1">
      <div
        class="absolute top-0 bottom-0 w-px bg-foreground/20 pointer-events-none"
        :style="{ left: leftPct(hover) }"
      />
      <div
        v-for="s in series"
        :key="s.label"
        :class="['absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2 ring-card pointer-events-none', s.colorClass]"
        :style="{ left: leftPct(hover), top: topPct(s.values[hover] ?? 0) }"
      />
      <!-- Teleported to body + fixed so the parent card's overflow-hidden can't clip it. -->
      <Teleport to="body">
        <div
          class="fixed z-50 pointer-events-none rounded-lg border border-border bg-popover px-2.5 py-1.5 shadow-lg whitespace-nowrap"
          :style="{
            left: `${mouseX}px`,
            top: `${mouseY - 12}px`,
            transform: `translateY(-100%) ${tooltipAlign === 'center' ? 'translateX(-50%)' : tooltipAlign === 'right' ? 'translateX(-100%)' : 'translateX(0)'}`,
          }"
        >
          <p class="text-[10px] text-muted-foreground mb-0.5">
            {{ formatDateTime(timestamps[hover]) }}
          </p>
          <div
            v-for="s in series"
            :key="s.label"
            class="flex items-center gap-1.5 text-[11px]"
          >
            <span :class="['size-1.5 rounded-full bg-current', s.colorClass]" />
            <span class="text-muted-foreground">{{ s.label }}</span>
            <span class="font-medium tabular-nums ml-auto">{{ format(s.values[hover] ?? 0) }}</span>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>
