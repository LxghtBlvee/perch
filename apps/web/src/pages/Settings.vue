<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

const showToken = ref(false)
</script>

<template>
  <div class="p-6 space-y-6 max-w-2xl">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">
        Settings
      </h1>
      <p class="text-sm text-muted-foreground mt-1">
        Manage your Perch instance.
      </p>
    </div>

    <div class="rounded-xl border border-border bg-card divide-y divide-border">
      <div class="p-5">
        <h3 class="text-sm font-medium mb-1">
          Hub token
        </h3>
        <p class="text-xs text-muted-foreground mb-3">
          The shared secret used to authenticate agents. Set via
          <code class="bg-muted px-1 py-0.5 rounded text-xs">PERCH_HUB_TOKEN</code>
          environment variable.
        </p>
        <div class="flex items-center gap-2">
          <div class="flex-1 font-mono text-xs bg-muted px-3 py-2 rounded-lg text-muted-foreground select-all">
            {{ showToken ? 'PERCH_HUB_TOKEN (set in environment)' : '••••••••••••••••••••••••' }}
          </div>
          <button
            class="size-9 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors"
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

      <div class="p-5">
        <h3 class="text-sm font-medium mb-1">
          Color mode
        </h3>
        <p class="text-xs text-muted-foreground">
          Follows your operating system preference. Manual toggle coming soon.
        </p>
      </div>

      <div class="p-5">
        <h3 class="text-sm font-medium mb-1">
          Version
        </h3>
        <p class="text-xs text-muted-foreground font-mono">
          perch v0.0.1
        </p>
      </div>
    </div>
  </div>
</template>
