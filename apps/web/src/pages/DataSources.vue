<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Trash2, CheckCircle, XCircle, Loader, Star, Zap, ArrowRight } from 'lucide-vue-next'
import Tooltip from '@/components/Tooltip.vue'
import type { DataSource, DataSourceType } from '@perch/types'
import { useApi } from '@/composables/useApi'
import { useCache } from '@/composables/useCache'
import { useAuthStore } from '@/stores/auth'
import { datasourceIcons } from '@/icons/datasource'

const auth = useAuthStore()
const { apiFetch, cachedFetch } = useApi()
const { invalidate } = useCache()

const DS_CACHE_KEY = '/api/data-sources'

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

interface TypeMeta {
  label: string
  desc: string
  placeholder: string
  hint: string
  color: string
  bg: string
  border: string
}

const TYPE_META: Record<DataSourceType, TypeMeta> = {
  prometheus: {
    label: 'Prometheus',
    desc: 'Metrics & alerting',
    placeholder: 'http://localhost:9090',
    hint: 'Queries /api/v1/query · Health via /-/healthy',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    border: 'border-orange-400/30',
  },
  loki: {
    label: 'Loki',
    desc: 'Log aggregation',
    placeholder: 'http://localhost:3100',
    hint: 'Queries /loki/api/v1/query · Health via /ready',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/30',
  },
  influxdb: {
    label: 'InfluxDB',
    desc: 'Time series database',
    placeholder: 'http://localhost:8086',
    hint: 'Queries /api/v2/query · Token auth required',
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/30',
  },
  graphite: {
    label: 'Graphite',
    desc: 'Metrics storage',
    placeholder: 'http://localhost',
    hint: 'Queries /render?format=json · Health via /metrics',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/30',
  },
}

async function fetchSources() {
  loading.value = true
  try {
    sources.value = await cachedFetch<DataSource[]>(DS_CACHE_KEY, 60_000)
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
    const res = await apiFetch('/api/data-sources', {
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
    invalidate(DS_CACHE_KEY)
    showForm.value = false
    form.value = defaultForm()
  } catch (e) {
    formError.value = String(e)
  } finally {
    saving.value = false
  }
}

async function remove(id: string) {
  const prev = [...sources.value]
  sources.value = sources.value.filter(s => s.id !== id)
  invalidate(DS_CACHE_KEY)
  try {
    const res = await apiFetch(`/api/data-sources/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error()
  } catch {
    sources.value = prev
  }
}

async function test(id: string) {
  testResults.value[id] = 'testing'
  try {
    const res = await apiFetch(`/api/data-sources/${id}/test`, { method: 'POST' })
    const data = await res.json()
    testResults.value[id] = data.ok ? 'ok' : 'fail'
  } catch {
    testResults.value[id] = 'fail'
  }
  setTimeout(() => { testResults.value[id] = 'idle' }, 4000)
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
        v-if="!showForm && auth.isAdmin"
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
      class="rounded-2xl border border-border bg-card overflow-hidden"
    >
      <div class="px-6 py-4 border-b border-border bg-muted/30">
        <h2 class="text-sm font-semibold">
          New data source
        </h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          Choose a type and enter your connection details.
        </p>
      </div>

      <div class="p-6 space-y-6">
        <!-- Type selector -->
        <div class="space-y-2">
          <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</label>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              v-for="(meta, key) in TYPE_META"
              :key="key"
              :class="[
                'relative flex flex-col items-start gap-3 p-3.5 rounded-xl border text-left transition-all',
                form.type === key
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border hover:bg-accent/50',
              ]"
              @click="form.type = key as DataSourceType"
            >
              <div
                v-if="form.type === key"
                class="absolute top-2.5 right-2.5 size-1.5 rounded-full bg-primary"
              />
              <div
                :class="[
                  'size-9 rounded-lg flex items-center justify-center p-1.5 transition-colors',
                  form.type === key ? meta.bg : 'bg-muted',
                ]"
              >
                <img
                  :src="datasourceIcons[key]"
                  :alt="meta.label"
                  class="size-full object-contain"
                >
              </div>
              <div>
                <p class="text-sm font-semibold leading-none">
                  {{ meta.label }}
                </p>
                <p class="text-[11px] text-muted-foreground mt-1 leading-none">
                  {{ meta.desc }}
                </p>
              </div>
            </button>
          </div>
        </div>

        <!-- Name + URL -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <p class="text-[11px] text-muted-foreground flex items-center gap-1">
              <Zap class="size-3 shrink-0" />
              {{ TYPE_META[form.type].hint }}
            </p>
          </div>
        </div>

        <!-- Default toggle -->
        <label class="flex items-center gap-3 cursor-pointer w-fit group">
          <div
            :class="[
              'relative w-9 h-5 rounded-full transition-colors',
              form.isDefault ? 'bg-primary' : 'bg-muted group-hover:bg-muted-foreground/20',
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
          <div>
            <p class="text-sm font-medium leading-none">
              Set as default
            </p>
            <p class="text-xs text-muted-foreground mt-1">
              Used when no data source is explicitly selected
            </p>
          </div>
        </label>

        <p
          v-if="formError"
          class="text-xs text-red-400"
        >
          {{ formError }}
        </p>

        <div class="flex items-center gap-2 pt-2 border-t border-border">
          <button
            class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            :disabled="saving"
            @click="save"
          >
            {{ saving ? 'Saving…' : 'Save data source' }}
          </button>
          <button
            class="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
            @click="cancelForm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div
      v-if="loading"
      class="space-y-3"
    >
      <div
        v-for="i in 2"
        :key="i"
        class="rounded-2xl border border-border bg-card p-5 flex items-center gap-5 animate-pulse"
      >
        <div class="size-12 rounded-xl bg-muted shrink-0" />
        <div class="flex-1 space-y-2">
          <div class="flex items-center gap-2">
            <div class="h-4 w-28 bg-muted rounded" />
            <div class="h-4 w-14 bg-muted rounded" />
          </div>
          <div class="h-3 w-52 bg-muted rounded" />
          <div class="h-3 w-40 bg-muted rounded" />
        </div>
        <div class="h-8 w-32 bg-muted rounded-lg shrink-0" />
        <div class="size-9 bg-muted rounded-xl shrink-0" />
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="sources.length === 0 && !showForm"
      class="rounded-2xl border border-dashed border-border p-12"
    >
      <div class="max-w-sm mx-auto text-center space-y-6">
        <div class="grid grid-cols-4 gap-2">
          <div
            v-for="(meta, key) in TYPE_META"
            :key="key"
            :class="['rounded-xl border p-3 flex flex-col items-center gap-2', meta.border, meta.bg]"
          >
            <img
              :src="datasourceIcons[key]"
              :alt="meta.label"
              class="size-7 object-contain"
            >
            <span :class="['text-[10px] font-semibold', meta.color]">{{ meta.label }}</span>
          </div>
        </div>
        <div>
          <p class="text-sm font-medium">
            No data sources connected
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            Connect Prometheus, Loki, InfluxDB, or Graphite to power your dashboards.
          </p>
        </div>
        <button
          v-if="auth.isAdmin"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          @click="showForm = true"
        >
          <Plus class="size-4" />
          Add your first source
        </button>
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
        class="group rounded-2xl border border-border bg-card p-5 flex items-center gap-5 hover:shadow-sm transition-all"
      >
        <!-- Brand logo -->
        <div
          :class="[
            'size-12 rounded-xl border flex items-center justify-center shrink-0 p-2',
            TYPE_META[ds.type].bg,
            TYPE_META[ds.type].border,
          ]"
        >
          <img
            :src="datasourceIcons[ds.type]"
            :alt="TYPE_META[ds.type].label"
            class="size-full object-contain"
          >
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="font-semibold text-sm">
              {{ ds.name }}
            </p>
            <span
              v-if="ds.isDefault"
              class="flex items-center gap-1 text-[10px] font-semibold text-amber-500 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-md"
            >
              <Star class="size-2.5" /> default
            </span>
            <span :class="['text-[10px] font-semibold px-1.5 py-0.5 rounded-md border', TYPE_META[ds.type].bg, TYPE_META[ds.type].color, TYPE_META[ds.type].border]">
              {{ TYPE_META[ds.type].label }}
            </span>
          </div>
          <p class="text-xs font-mono text-muted-foreground mt-1 truncate">
            {{ ds.url }}
          </p>
          <p class="text-[11px] text-muted-foreground/60 mt-0.5 flex items-center gap-1">
            <ArrowRight class="size-3 shrink-0" />
            {{ TYPE_META[ds.type].hint }}
          </p>
        </div>

        <!-- Test connection -->
        <button
          :class="[
            'flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg border font-medium shrink-0 transition-all',
            testResults[ds.id] === 'ok'
              ? 'border-green-500/40 bg-green-500/10 text-green-500'
              : testResults[ds.id] === 'fail'
                ? 'border-red-500/40 bg-red-500/10 text-red-400'
                : 'border-border hover:bg-accent text-muted-foreground',
            testResults[ds.id] === 'testing' ? 'opacity-60 pointer-events-none' : '',
          ]"
          @click="test(ds.id)"
        >
          <Loader
            v-if="testResults[ds.id] === 'testing'"
            class="size-3.5 animate-spin"
          />
          <CheckCircle
            v-else-if="testResults[ds.id] === 'ok'"
            class="size-3.5"
            :stroke-width="2"
          />
          <XCircle
            v-else-if="testResults[ds.id] === 'fail'"
            class="size-3.5"
            :stroke-width="2"
          />
          <span>
            {{
              testResults[ds.id] === 'testing' ? 'Testing…'
              : testResults[ds.id] === 'ok' ? 'Connected'
                : testResults[ds.id] === 'fail' ? 'Failed'
                  : 'Test connection'
            }}
          </span>
        </button>

        <!-- Delete -->
        <Tooltip
          v-if="auth.isAdmin"
          text="Remove"
        >
          <button
            class="size-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-red-400 hover:border-red-400/40 hover:bg-red-400/5 transition-all shrink-0 opacity-0 group-hover:opacity-100"
            @click="remove(ds.id)"
          >
            <Trash2
              class="size-3.5"
              :stroke-width="2"
            />
          </button>
        </Tooltip>
      </div>
    </div>
  </div>
</template>
