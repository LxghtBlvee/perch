<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Trash2, CheckCircle, XCircle, Clock } from 'lucide-vue-next'
import { usePerchStore } from '@/stores/perch'

const store = usePerchStore()

const showForm = ref(false)
const form = ref({ name: '', url: '', interval: 60 })

async function createCheck() {
  if (!form.value.name || !form.value.url) return
  await fetch('/api/health-checks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form.value),
  })
  form.value = { name: '', url: '', interval: 60 }
  showForm.value = false
}

async function deleteCheck(id: string) {
  await fetch(`/api/health-checks/${id}`, { method: 'DELETE' })
  store.healthChecks = store.healthChecks.filter(h => h.id !== id)
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Health Checks</h1>
        <p class="text-sm text-muted-foreground mt-1">Monitor HTTP endpoints.</p>
      </div>
      <button
        class="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
        @click="showForm = !showForm"
      >
        <Plus class="size-4" :stroke-width="2" />
        Add check
      </button>
    </div>

    <!-- Add form -->
    <div v-if="showForm" class="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 class="text-sm font-medium">New health check</h3>
      <div class="grid grid-cols-3 gap-3">
        <div class="space-y-1.5">
          <label class="text-xs text-muted-foreground">Name</label>
          <input
            v-model="form.name"
            placeholder="My API"
            class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs text-muted-foreground">URL</label>
          <input
            v-model="form.url"
            placeholder="https://example.com/health"
            class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs text-muted-foreground">Interval (seconds)</label>
          <input
            v-model.number="form.interval"
            type="number"
            min="10"
            class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div class="flex gap-2">
        <button
          class="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          @click="createCheck"
        >
          Save
        </button>
        <button
          class="px-3 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
          @click="showForm = false"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="store.healthChecks.length === 0 && !showForm" class="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground text-sm">
      No health checks configured yet.
    </div>

    <!-- List -->
    <div class="space-y-3">
      <div
        v-for="check in store.healthChecks"
        :key="check.id"
        class="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
      >
        <CheckCircle v-if="check.status === 'up'" class="size-5 text-green-500 shrink-0" :stroke-width="2" />
        <XCircle v-else-if="check.status === 'down'" class="size-5 text-destructive shrink-0" :stroke-width="2" />
        <Clock v-else class="size-5 text-muted-foreground shrink-0" :stroke-width="2" />

        <div class="flex-1 min-w-0">
          <p class="font-medium text-sm">{{ check.name }}</p>
          <p class="text-xs text-muted-foreground font-mono truncate">{{ check.url }}</p>
        </div>

        <div class="text-right text-xs text-muted-foreground shrink-0">
          <p v-if="check.latency !== null">{{ check.latency }}ms</p>
          <p>every {{ check.interval }}s</p>
        </div>

        <button
          class="size-8 rounded-lg border border-border flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors ml-2"
          @click="deleteCheck(check.id)"
        >
          <Trash2 class="size-3.5" :stroke-width="2" />
        </button>
      </div>
    </div>
  </div>
</template>
