<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Eye, EyeOff, KeyRound } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useColorMode, type ColorMode } from '@/composables/useColorMode'

const auth = useAuthStore()
const { mode: colorMode, setMode } = useColorMode()
const showToken = ref(false)

const COLOR_MODES: { value: ColorMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
]
</script>

<template>
  <div class="p-6 space-y-8 max-w-5xl">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">
        Settings
      </h1>
      <p class="text-sm text-muted-foreground mt-1">
        Manage your Perch instance.
      </p>
    </div>

    <!-- General — 3-col grid -->
    <section>
      <h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
        General
      </h2>
      <div class="grid grid-cols-3 gap-4">
        <!-- Hub token -->
        <div class="col-span-2 rounded-xl border border-border bg-card p-5 space-y-3">
          <div>
            <h3 class="text-sm font-medium">
              Hub token
            </h3>
            <p class="text-xs text-muted-foreground mt-0.5">
              Shared secret for agent auth. Set via
              <code class="bg-muted px-1 py-0.5 rounded">PERCH_HUB_TOKEN</code>.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex-1 font-mono text-xs bg-muted px-3 py-2 rounded-lg text-muted-foreground select-all">
              {{ showToken ? 'PERCH_HUB_TOKEN (set in environment)' : '••••••••••••••••••••••••' }}
            </div>
            <button
              class="size-9 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors shrink-0"
              @click="showToken = !showToken"
            >
              <Eye
                v-if="!showToken"
                class="size-4 text-muted-foreground"
                :stroke-width="1.75"
              />
              <EyeOff
                v-else
                class="size-4 text-muted-foreground"
                :stroke-width="1.75"
              />
            </button>
          </div>
        </div>

        <!-- Version -->
        <div class="rounded-xl border border-border bg-card p-5 flex flex-col justify-between">
          <div>
            <h3 class="text-sm font-medium">
              Version
            </h3>
            <p class="text-xs text-muted-foreground mt-0.5">
              Current release
            </p>
          </div>
          <p class="text-2xl font-mono font-semibold text-primary mt-4">
            v0.0.1
          </p>
        </div>

        <!-- Color mode — full width -->
        <div class="col-span-3 rounded-xl border border-border bg-card p-5">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-medium">
                Color mode
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                Choose light, dark, or follow your OS.
              </p>
            </div>
            <div class="flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
              <button
                v-for="m in COLOR_MODES"
                :key="m.value"
                class="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                :class="colorMode === m.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'"
                @click="setMode(m.value)"
              >
                {{ m.label }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Auth — admin only -->
    <template v-if="auth.isAdmin">
      <section>
        <h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Authentication
        </h2>
        <RouterLink
          to="/admin/auth"
          class="flex items-center justify-between rounded-xl border border-border bg-card p-5 hover:bg-accent transition-colors group"
        >
          <div class="flex items-center gap-3">
            <div class="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <KeyRound
                class="size-4 text-primary"
                :stroke-width="1.75"
              />
            </div>
            <div>
              <p class="text-sm font-medium">
                Sign-in methods
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                Configure GitHub, Google, Microsoft, and more
              </p>
            </div>
          </div>
          <span class="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Manage →</span>
        </RouterLink>
      </section>
    </template>
  </div>
</template>
