<script setup lang="ts">
import { ref } from 'vue'
import { useToast, type ToastLevel } from '@/composables/useToast'
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-vue-next'

const { toasts, remove } = useToast()

const pausedIds = ref<string[]>([])
function pause(id: string) { if (!pausedIds.value.includes(id)) pausedIds.value.push(id) }
function resume(id: string) { pausedIds.value = pausedIds.value.filter(i => i !== id) }

type LevelConfig = { icon: unknown; bar: string; iconClass: string; border: string }
const LEVELS: Record<ToastLevel, LevelConfig> = {
  success: { icon: CheckCircle2, bar: 'bg-green-500',          iconClass: 'text-green-500',          border: 'border-green-500/20' },
  error:   { icon: AlertCircle,  bar: 'bg-red-500',            iconClass: 'text-red-500',            border: 'border-red-500/20' },
  warning: { icon: AlertTriangle,bar: 'bg-amber-500',          iconClass: 'text-amber-500',          border: 'border-amber-500/20' },
  info:    { icon: Info,         bar: 'bg-primary',            iconClass: 'text-primary',            border: 'border-primary/20' },
  loading: { icon: Loader2,      bar: 'bg-muted-foreground',   iconClass: 'text-muted-foreground',   border: 'border-border' },
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-80 pointer-events-none">
      <TransitionGroup
        name="toast"
        tag="div"
        class="flex flex-col gap-2"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['relative rounded-xl border bg-card shadow-xl overflow-hidden pointer-events-auto select-none', LEVELS[toast.level].border]"
          @mouseenter="pause(toast.id)"
          @mouseleave="resume(toast.id)"
        >
          <!-- Body -->
          <div class="flex items-start gap-3 px-4 py-3.5 pr-9">
            <component
              :is="LEVELS[toast.level].icon"
              class="size-4 mt-0.5 shrink-0"
              :class="[LEVELS[toast.level].iconClass, toast.level === 'loading' && 'animate-spin']"
              :stroke-width="1.75"
            />
            <p class="text-sm text-foreground leading-snug">
              {{ toast.message }}
            </p>
          </div>

          <!-- Dismiss -->
          <button
            class="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            @click="remove(toast.id)"
          >
            <X
              class="size-3.5"
              :stroke-width="1.75"
            />
          </button>

          <!-- Progress bar -->
          <div
            v-if="toast.duration > 0"
            :class="['absolute bottom-0 left-0 h-0.5 w-full origin-left', LEVELS[toast.level].bar]"
            :style="`animation: toast-shrink ${toast.duration}ms linear forwards; animation-play-state: ${pausedIds.includes(toast.id) ? 'paused' : 'running'};`"
          />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active { transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-leave-active { transition: all 0.18s ease; }
.toast-enter-from,
.toast-leave-to { opacity: 0; transform: translateX(calc(100% + 1rem)); }
.toast-move { transition: transform 0.2s ease; }
</style>

<style>
@keyframes toast-shrink {
  from { transform: scaleX(1); }
  to   { transform: scaleX(0); }
}
</style>
