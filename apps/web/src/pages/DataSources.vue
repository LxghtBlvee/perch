<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Trash2, CheckCircle, XCircle, Loader, Database, Star } from 'lucide-vue-next'
import type { DataSource, DataSourceType } from '@perch/types'

const sources = ref<DataSource[]>([])
const loading = ref(true)
const showForm = ref(false)

const testResults = ref<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>({})

const defaultForm = () => ({
  name: '',
  type: 'prometheus' as DataSourceType,
  url: '',
  isDefault: false,
})
const form = ref(defaultForm())
const saving = ref(false)
const formError = ref('')

const TYPE_META: Record<DataSourceType, { label: string; placeholder: string; color: string }> = {
  prometheus: { label: 'Prometheus', placeholder: 'http://localhost:9090', color: 'text-orange-400' },
  loki:       { label: 'Loki',       placeholder: 'http://localhost:3100', color: 'text-yellow-400' },
  influxdb:   { label: 'InfluxDB',   placeholder: 'http://localhost:8086', color: 'text-sky-400'    },
  graphite:   { label: 'Graphite',   placeholder: 'http://localhost:2003', color: 'text-purple-400' },
}

async function fetchSources() {
  loading.value = true
  try {
    const res = await fetch('/api/data-sources')
    sources.value = await res.json()
  } finally {
    loading.value = false
  }
}

async function save() {
  formError.value = ''
  if (!form.value.name.trim() || !form.value.url.trim()) {
    formError.value = 'Name and URL are required.'
    return
  }
  saving.value = true
  try {
    const res = await fetch('/api/data-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    })
    if (!res.ok) throw new Error(await res.text())
    const ds: DataSource = await res.json()
    if (form.value.isDefault) {
      sources.value.forEach(s => { s.isDefault = false })
    }
    sources.value.push(ds)
    showForm.value = false
    form.value = defaultForm()
  } catch (e) {
    formError.value = String(e)
  } finally {
    saving.value = false
  }
}

async function remove(id: string) {
  await fetch(`/api/data-sources/${id}`, { method: 'DELETE' })
  sources.value = sources.value.filter(s => s.id !== id)
}

async function test(id: string) {
  testResults.value[id] = 'testing'
  try {
    const res = await fetch(`/api/data-sources/${id}/test`, { method: 'POST' })
    const data = await res.json()
    testResults.value[id] = data.ok ? 'ok' : 'fail'
  } catch {
    testResults.value[id] = 'fail'
  }
  setTimeout(() => {
    testResults.value[id] = 'idle'
  }, 4000)
}

function cancelForm() {
  showForm.value = false
  form.value = defaultForm()
  formError.value = ''
}

onMounted(fetchSources)
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          Data Sources
        </h1>
        <p class="text-sm text-muted-foreground mt-0.5">
          Connect Prometheus, Loki, InfluxDB, and more.
        </p>
      </div>
      <button
        v-if="!showForm"
        class="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        @click="showForm = true"
      >
        <Plus
          class="size-4"
          :stroke-width="2"
        />
        Add data source
      </button>
    </div>

    <!-- Add form -->
    <div
      v-if="showForm"
      class="rounded-xl border border-border bg-card p-5 space-y-4"
    >
      <h2 class="text-sm font-semibold">
        New data source
      </h2>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- Type -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-muted-foreground">Type</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="(meta, key) in TYPE_META"
              :key="key"
              :class="[
                'px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left',
                form.type === key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent',
              ]"
              @click="form.type = key as DataSourceType"
            >
              <span :class="[meta.color, 'font-semibold']">{{ meta.label }}</span>
            </button>
          </div>
        </div>

        <!-- Name + URL -->
        <div class="space-y-3">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-muted-foreground">Name</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="My Prometheus"
              class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-muted-foreground">URL</label>
            <input
              v-model="form.url"
              type="text"
              :placeholder="TYPE_META[form.type].placeholder"
              class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
          </div>
        </div>
      </div>

      <!-- Default toggle -->
      <label class="flex items-center gap-3 cursor-pointer w-fit">
        <div
          :class="[
            'relative w-9 h-5 rounded-full transition-colors',
            form.isDefault ? 'bg-primary' : 'bg-muted',
          ]"
          @click="form.isDefault = !form.isDefault"
        >
          <div
            :class="[
              'absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform',
              form.isDefault ? 'translate-x-4' : 'translate-x-0.5',
            ]"
          />
        </div>
        <span class="text-sm text-muted-foreground">Set as default</span>
      </label>

      <p
        v-if="formError"
        class="text-xs text-red-400"
      >
        {{ formError }}
      </p>

      <div class="flex items-center gap-2 pt-1">
        <button
          class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <button
          class="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
          @click="cancelForm"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="space-y-3"
    >
      <div
        v-for="i in 2"
        :key="i"
        class="h-20 rounded-xl border border-border bg-card animate-pulse"
      />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="sources.length === 0 && !showForm"
      class="rounded-xl border border-dashed border-border p-16 flex flex-col items-center gap-4 text-center"
    >
      <Database
        class="size-10 text-muted-foreground/30"
        :stroke-width="1.25"
      />
      <div>
        <p class="text-sm font-medium text-muted-foreground">
          No data sources yet
        </p>
        <p class="text-xs text-muted-foreground/60 mt-1">
          Connect Prometheus, Loki, or InfluxDB to enrich your dashboards.
        </p>
      </div>
    </div>

    <!-- Sources list -->
    <div
      v-else-if="!loading"
      class="space-y-3"
    >
      <div
        v-for="ds in sources"
        :key="ds.id"
        class="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
      >
        <!-- Type badge -->
        <div class="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Database
            :class="['size-5', TYPE_META[ds.type].color]"
            :stroke-width="1.5"
          />
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="font-semibold text-sm truncate">
              {{ ds.name }}
            </p>
            <span
              v-if="ds.isDefault"
              class="flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded"
            >
              <Star class="size-2.5" /> default
            </span>
            <span :class="['text-xs font-medium px-1.5 py-0.5 rounded bg-muted', TYPE_META[ds.type].color]">
              {{ TYPE_META[ds.type].label }}
            </span>
          </div>
          <p class="text-xs font-mono text-muted-foreground mt-0.5 truncate">
            {{ ds.url }}
          </p>
        </div>

        <!-- Test button -->
        <button
          class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors shrink-0"
          :class="{ 'opacity-50 pointer-events-none': testResults[ds.id] === 'testing' }"
          @click="test(ds.id)"
        >
          <Loader
            v-if="testResults[ds.id] === 'testing'"
            class="size-3 animate-spin"
          />
          <CheckCircle
            v-else-if="testResults[ds.id] === 'ok'"
            class="size-3 text-green-400"
          />
          <XCircle
            v-else-if="testResults[ds.id] === 'fail'"
            class="size-3 text-red-400"
          />
          <span>
            {{
              testResults[ds.id] === 'testing' ? 'Testing…'
              : testResults[ds.id] === 'ok' ? 'Connected'
                : testResults[ds.id] === 'fail' ? 'Failed'
                  : 'Test'
            }}
          </span>
        </button>

        <!-- Delete -->
        <button
          class="size-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors shrink-0"
          @click="remove(ds.id)"
        >
          <Trash2
            class="size-3.5"
            :stroke-width="2"
          />
        </button>
      </div>
    </div>
  </div>
</template>
