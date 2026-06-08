<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Globe, Lock } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const pageId = route.params.id as string

interface HealthCheck { id: string; name: string; url: string }
type DisplayMode = 'full_history' | 'response_time' | 'current_status'

interface PageCheck {
  id?: string
  healthCheckId: string
  checkName: string
  checkUrl: string
  displayName: string
  displayMode: DisplayMode
  showUrl: boolean
}

interface PageData {
  id: string
  slug: string
  name: string
  isPublic: boolean
}

const page = ref<PageData | null>(null)
const checks = ref<PageCheck[]>([])
const allHealthChecks = ref<HealthCheck[]>([])
const loading = ref(true)
const saving = ref(false)
const savingMeta = ref(false)
const saveError = ref('')
const savedMeta = ref(false)
const showAddPicker = ref(false)

const availableChecks = computed(() =>
  allHealthChecks.value.filter(hc => !checks.value.some(c => c.healthCheckId === hc.id))
)

onMounted(async () => {
  const [pageRes, allChecksRes] = await Promise.all([
    fetch(`/api/admin/status-pages/${pageId}`, { headers: { Authorization: `Bearer ${auth.token}` } }),
    fetch('/api/health-checks', { headers: { Authorization: `Bearer ${auth.token}` } }),
  ])

  if (pageRes.ok) {
    const data = await pageRes.json() as PageData & { checks: Array<PageCheck & { checkName: string; checkUrl: string }> }
    page.value = { id: data.id, slug: data.slug, name: data.name, isPublic: data.isPublic }
    checks.value = data.checks.map(c => ({
      id: c.id,
      healthCheckId: c.healthCheckId,
      checkName: c.checkName,
      checkUrl: c.checkUrl,
      displayName: c.displayName ?? '',
      displayMode: c.displayMode,
      showUrl: c.showUrl,
    }))
  }

  if (allChecksRes.ok) {
    allHealthChecks.value = await allChecksRes.json() as HealthCheck[]
  }

  loading.value = false
})

async function saveMeta() {
  if (!page.value) return
  savingMeta.value = true
  const res = await fetch(`/api/admin/status-pages/${pageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ name: page.value.name, slug: page.value.slug, isPublic: page.value.isPublic }),
  })
  savingMeta.value = false
  if (res.ok) {
    savedMeta.value = true
    setTimeout(() => { savedMeta.value = false }, 2000)
  }
}

async function saveChecks() {
  saving.value = true
  saveError.value = ''
  const res = await fetch(`/api/admin/status-pages/${pageId}/checks`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({
      checks: checks.value.map(c => ({
        healthCheckId: c.healthCheckId,
        displayName: c.displayName || undefined,
        displayMode: c.displayMode,
        showUrl: c.showUrl,
      }))
    }),
  })
  saving.value = false
  if (!res.ok) {
    const data = await res.json() as { error?: string }
    saveError.value = data.error ?? 'Save failed'
  }
}

function addCheck(hc: HealthCheck) {
  checks.value.push({
    healthCheckId: hc.id,
    checkName: hc.name,
    checkUrl: hc.url,
    displayName: '',
    displayMode: 'full_history',
    showUrl: false,
  })
  showAddPicker.value = false
  saveChecks()
}

function removeCheck(i: number) {
  checks.value.splice(i, 1)
  saveChecks()
}

function moveUp(i: number) {
  if (i === 0) return
  ;[checks.value[i - 1], checks.value[i]] = [checks.value[i], checks.value[i - 1]]
  saveChecks()
}

function moveDown(i: number) {
  if (i === checks.value.length - 1) return
  ;[checks.value[i], checks.value[i + 1]] = [checks.value[i + 1], checks.value[i]]
  saveChecks()
}

const DISPLAY_MODES: { value: DisplayMode; label: string; desc: string }[] = [
  { value: 'full_history', label: 'Full history', desc: '90-day uptime bars + %' },
  { value: 'response_time', label: 'Response time', desc: 'Latency graph' },
  { value: 'current_status', label: 'Current only', desc: 'Just a status dot' },
]

const INPUT = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50'
</script>

<template>
  <div class="p-6 max-w-3xl space-y-6">
    <div class="flex items-center gap-3">
      <button
        class="size-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors"
        @click="router.push('/admin/status-pages')"
      >
        <ArrowLeft
          class="size-4 text-muted-foreground"
          :stroke-width="1.75"
        />
      </button>
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ page?.name ?? 'Edit Status Page' }}
      </h1>
    </div>

    <div
      v-if="loading"
      class="text-sm text-muted-foreground"
    >
      Loading...
    </div>

    <template v-else-if="page">
      <!-- Page settings card -->
      <div class="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 class="text-sm font-medium">
          Page settings
        </h2>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">Name</label>
            <input
              v-model="page.name"
              type="text"
              :class="INPUT"
            >
          </div>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">Slug</label>
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground shrink-0">/status/</span>
              <input
                v-model="page.slug"
                type="text"
                :class="INPUT"
              >
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-sm">
            <component
              :is="page.isPublic ? Globe : Lock"
              class="size-4 text-muted-foreground"
              :stroke-width="1.75"
            />
            <span>{{ page.isPublic ? 'Public — anyone with the link can view' : 'Private — requires sign-in' }}</span>
          </div>
          <button
            class="relative shrink-0 w-9 h-5 rounded-full transition-colors"
            :class="page.isPublic ? 'bg-primary' : 'bg-muted'"
            @click="page.isPublic = !page.isPublic"
          >
            <div :class="['absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform', page.isPublic ? 'translate-x-4' : 'translate-x-0.5']" />
          </button>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <button
            :disabled="savingMeta"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            :class="savedMeta ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary hover:bg-primary/20'"
            @click="saveMeta"
          >
            {{ savingMeta ? 'Saving...' : savedMeta ? 'Saved!' : 'Save' }}
          </button>
          <a
            :href="`/status/${page.slug}`"
            target="_blank"
            class="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Preview →
          </a>
        </div>
      </div>

      <!-- Checks section -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-medium">
            Checks <span class="text-muted-foreground font-normal">({{ checks.length }})</span>
          </h2>
          <button
            v-if="availableChecks.length > 0"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors"
            @click="showAddPicker = !showAddPicker"
          >
            <Plus
              class="size-3.5"
              :stroke-width="1.75"
            />
            Add check
          </button>
        </div>

        <!-- Add check picker -->
        <div
          v-if="showAddPicker"
          class="rounded-xl border border-border bg-card p-4 space-y-2"
        >
          <p class="text-xs text-muted-foreground mb-2">
            Select a health check to add:
          </p>
          <button
            v-for="hc in availableChecks"
            :key="hc.id"
            class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left"
            @click="addCheck(hc)"
          >
            <span class="text-sm font-medium">{{ hc.name }}</span>
            <span class="text-xs text-muted-foreground font-mono truncate max-w-48">{{ hc.url }}</span>
          </button>
        </div>

        <p
          v-if="saveError"
          class="text-xs text-red-500"
        >
          {{ saveError }}
        </p>

        <div
          v-if="checks.length === 0"
          class="rounded-xl border border-dashed border-border p-8 text-center"
        >
          <p class="text-sm text-muted-foreground">
            No checks added yet. Add some health checks to display on this page.
          </p>
        </div>

        <!-- Check cards -->
        <div
          v-for="(check, i) in checks"
          :key="check.healthCheckId"
          class="rounded-xl border border-border bg-card p-5 space-y-4"
        >
          <div class="flex items-start gap-3">
            <div class="flex flex-col gap-1">
              <button
                class="size-6 rounded flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-30"
                :disabled="i === 0"
                @click="moveUp(i)"
              >
                <ChevronUp
                  class="size-3.5 text-muted-foreground"
                  :stroke-width="2"
                />
              </button>
              <button
                class="size-6 rounded flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-30"
                :disabled="i === checks.length - 1"
                @click="moveDown(i)"
              >
                <ChevronDown
                  class="size-3.5 text-muted-foreground"
                  :stroke-width="2"
                />
              </button>
            </div>

            <div class="flex-1 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium">
                    {{ check.checkName }}
                  </p>
                  <p class="text-xs text-muted-foreground font-mono">
                    {{ check.checkUrl }}
                  </p>
                </div>
                <button
                  class="size-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
                  @click="removeCheck(i)"
                >
                  <Trash2
                    class="size-3.5 text-muted-foreground"
                    :stroke-width="1.75"
                  />
                </button>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1">
                  <label class="text-xs text-muted-foreground">Display name <span class="text-muted-foreground/50">(optional)</span></label>
                  <input
                    v-model="check.displayName"
                    type="text"
                    :placeholder="check.checkName"
                    :class="INPUT"
                    @change="saveChecks"
                  >
                </div>
                <div class="space-y-1">
                  <label class="text-xs text-muted-foreground">Display mode</label>
                  <select
                    v-model="check.displayMode"
                    :class="INPUT"
                    @change="saveChecks"
                  >
                    <option
                      v-for="m in DISPLAY_MODES"
                      :key="m.value"
                      :value="m.value"
                    >
                      {{ m.label }} — {{ m.desc }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button
                  class="relative shrink-0 w-8 h-4 rounded-full transition-colors"
                  :class="check.showUrl ? 'bg-primary' : 'bg-muted'"
                  @click="check.showUrl = !check.showUrl; saveChecks()"
                >
                  <div :class="['absolute top-0.5 size-3 rounded-full bg-white shadow transition-transform', check.showUrl ? 'translate-x-4' : 'translate-x-0.5']" />
                </button>
                <span class="text-xs text-muted-foreground">Show URL on status page</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>