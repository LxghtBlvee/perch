<script setup lang="ts">
import { useConfirm } from '@/composables/useConfirm'
import { AlertTriangle } from 'lucide-vue-next'

const { state, respond } = useConfirm()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition-all duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="state"
        class="fixed inset-0 z-[300] flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50"
          @click="respond(false)"
        />

        <!-- Card -->
        <Transition
          enter-active-class="transition-all duration-150"
          enter-from-class="opacity-0 scale-95"
          leave-active-class="transition-all duration-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="state"
            class="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl p-6 space-y-4"
          >
            <!-- Icon + title -->
            <div class="flex items-start gap-3">
              <div :class="['size-9 rounded-lg flex items-center justify-center shrink-0', state.danger ? 'bg-red-500/10' : 'bg-muted']">
                <AlertTriangle
                  :class="['size-4', state.danger ? 'text-red-500' : 'text-muted-foreground']"
                  :stroke-width="1.75"
                />
              </div>
              <div class="pt-1">
                <p class="text-sm font-semibold">
                  {{ state.title ?? 'Are you sure?' }}
                </p>
                <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {{ state.message }}
                </p>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-end gap-2 pt-1">
              <button
                class="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
                @click="respond(false)"
              >
                {{ state.cancelLabel ?? 'Cancel' }}
              </button>
              <button
                :class="[
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  state.danger
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                ]"
                @click="respond(true)"
              >
                {{ state.confirmLabel ?? 'Confirm' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
