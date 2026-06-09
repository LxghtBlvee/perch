<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Globe, Lock, AlertTriangle, Wrench, CheckCircle2, X } from 'lucide-vue-next'
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
  description: string | null
  logoUrl: string | null
  customDomain: string | null
  isPublic: boolean
}

type IncidentType = 'incident' | 'maintenance'
type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'scheduled' | 'in_progress' | 'completed'

interface Incident {
  id: string
  type: IncidentType
  title: string
  body: string
  status: IncidentStatus
  scheduledAt: string | null
  createdAt: string
  updatedAt: string
}

const page = ref<PageData | null>(null)
const checks = ref<PageCheck[]>([])
const incidents = ref<Incident[]>([])
const allHealthChecks = ref<HealthCheck[]>([])
const loading = ref(true)
const saving = ref(false)
const savingMeta = ref(false)
const saveError = ref('')
const savedMeta = ref(false)
const showAddPicker = ref(false)

// Incident modal state
const showIncidentModal = ref(false)
const editingIncident = ref<Incident | null>(null)
const incidentForm = ref({ type: 'incident' as IncidentType, title: '', body: '', status: 'investigating' as IncidentStatus, scheduledAt: '' })
const savingIncident = ref(false)

const availableChecks = computed(() =>
  allHealthChecks.value.filter(hc => !checks.value.some(c => c.healthCheckId === hc.id))
)

const activeIncidents = computed(() => incidents.value.filter(i => i.status !== 'resolved' && i.status !== 'completed'))
const resolvedIncidents = computed(() => incidents.value.filter(i => i.status === 'resolved' || i.status === 'completed'))

onMounted(async () => {
  const [pageRes, allChecksRes, incidentsRes] = await Promise.all([
    fetch(`/api/admin/status-pages/${pageId}`, { headers: { Authorization: `Bearer ${auth.token}` } }),
    fetch('/api/health-checks', { headers: { Authorization: `Bearer ${auth.token}` } }),
    fetch(`/api/admin/status-pages/${pageId}/incidents`, { headers: { Authorization: `Bearer ${auth.token}` } }),
  ])

  if (pageRes.ok) {
    const data = await pageRes.json() as PageData & { checks: Array<PageCheck & { checkName: string; checkUrl: string }> }
    page.value = {
      id: data.id, slug: data.slug, name: data.name, isPublic: data.isPublic,
      description: data.description ?? null, logoUrl: data.logoUrl ?? null, customDomain: data.customDomain ?? null,
    }
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

  if (incidentsRes.ok) {
    incidents.value = await incidentsRes.json() as Incident[]
  }

  loading.value = false
})

async function saveMeta() {
  if (!page.value) return
  savingMeta.value = true
  const res = await fetch(`/api/admin/status-pages/${pageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({
      name: page.value.name,
      slug: page.value.slug,
      isPublic: page.value.isPublic,
      description: page.value.description || null,
      logoUrl: page.value.logoUrl || null,
      customDomain: page.value.customDomain || null,
    }),
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

// Incidents
function openNewIncident() {
  editingIncident.value = null
  incidentForm.value = { type: 'incident', title: '', body: '', status: 'investigating', scheduledAt: '' }
  showIncidentModal.value = true
}

function openEditIncident(incident: Incident) {
  editingIncident.value = incident
  incidentForm.value = {
    type: incident.type,
    title: incident.title,
    body: incident.body,
    status: incident.status,
    scheduledAt: incident.scheduledAt ? incident.scheduledAt.slice(0, 16) : '',
  }
  showIncidentModal.value = true
}

async function saveIncident() {
  savingIncident.value = true
  const payload = {
    type: incidentForm.value.type,
    title: incidentForm.value.title,
    body: incidentForm.value.body,
    status: incidentForm.value.status,
    scheduledAt: incidentForm.value.scheduledAt || null,
  }

  let res: Response
  if (editingIncident.value) {
    res = await fetch(`/api/admin/status-pages/${pageId}/incidents/${editingIncident.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(payload),
    })
  } else {
    res = await fetch(`/api/admin/status-pages/${pageId}/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(payload),
    })
  }

  if (res.ok) {
    const updated = await res.json() as Incident
    if (editingIncident.value) {
      const idx = incidents.value.findIndex(i => i.id === updated.id)
      if (idx !== -1) incidents.value[idx] = updated
    } else {
      incidents.value.unshift(updated)
    }
    showIncidentModal.value = false
  }
  savingIncident.value = false
}

async function resolveIncident(incident: Incident) {
  const resolveStatus = incident.type === 'maintenance' ? 'completed' : 'resolved'
  const res = await fetch(`/api/admin/status-pages/${pageId}/incidents/${incident.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ status: resolveStatus }),
  })
  if (res.ok) {
    const updated = await res.json() as Incident
    const idx = incidents.value.findIndex(i => i.id === incident.id)
    if (idx !== -1) incidents.value[idx] = updated
  }
}

async function deleteIncident(incident: Incident) {
  const res = await fetch(`/api/admin/status-pages/${pageId}/incidents/${incident.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  if (res.ok) {
    incidents.value = incidents.value.filter(i => i.id !== incident.id)
  }
}

const INCIDENT_STATUSES: { value: IncidentStatus; label: string }[] = [
  { value: 'investigating', label: 'Investigating' },
  { value: 'identified', label: 'Identified' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'resolved', label: 'Resolved' },
]

const MAINTENANCE_STATUSES: { value: IncidentStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

const STATUS_COLORS: Record<IncidentStatus, string> = {
  investigating: 'text-red-500 bg-red-500/10',
  identified: 'text-amber-500 bg-amber-500/10',
  monitoring: 'text-blue-500 bg-blue-500/10',
  resolved: 'text-green-500 bg-green-500/10',
  scheduled: 'text-sky-500 bg-sky-500/10',
  in_progress: 'text-amber-500 bg-amber-500/10',
  completed: 'text-green-500 bg-green-500/10',
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
        <ArrowLeft class="size-4 text-muted-foreground" :stroke-width="1.75" />
      </button>
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ page?.name ?? 'Edit Status Page' }}
      </h1>
    </div>

    <div v-if="loading" class="text-sm text-muted-foreground">Loading...</div>

    <template v-else-if="page">
      <!-- Page settings card -->
      <div class="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 class="text-sm font-medium">Page settings</h2>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">Name</label>
            <input v-model="page.name" type="text" :class="INPUT">
          </div>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">Slug</label>
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground shrink-0">/status/</span>
              <input v-model="page.slug" type="text" :class="INPUT">
            </div>
          </div>
          <div class="space-y-1 col-span-2">
            <label class="text-xs text-muted-foreground">Description <span class="text-muted-foreground/50">(shown on public page)</span></label>
            <input v-model="page.description" type="text" placeholder="Brief description of your services" :class="INPUT">
          </div>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">Logo URL <span class="text-muted-foreground/50">(optional)</span></label>
            <input v-model="page.logoUrl" type="url" placeholder="https://..." :class="INPUT">
          </div>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">Custom domain <span class="text-muted-foreground/50">(optional)</span></label>
            <input v-model="page.customDomain" type="text" placeholder="status.example.com" :class="INPUT">
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-sm">
            <component :is="page.isPublic ? Globe : Lock" class="size-4 text-muted-foreground" :stroke-width="1.75" />
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
          <a :href="`/status/${page.slug}`" target="_blank" class="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Preview →
          </a>
        </div>
      </div>

      <!-- Incidents & Maintenance -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-medium">Incidents & Maintenance</h2>
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors"
            @click="openNewIncident"
          >
            <Plus class="size-3.5" :stroke-width="1.75" />
            New
          </button>
        </div>

        <!-- Active incidents -->
        <div v-if="activeIncidents.length === 0 && resolvedIncidents.length === 0" class="rounded-xl border border-dashed border-border p-6 text-center">
          <p class="text-sm text-muted-foreground">No incidents or maintenance windows. Nice.</p>
        </div>

        <div v-for="incident in activeIncidents" :key="incident.id" class="rounded-xl border border-border bg-card p-4 space-y-2">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2 min-w-0">
              <component :is="incident.type === 'maintenance' ? Wrench : AlertTriangle" class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.75" />
              <span class="text-sm font-medium truncate">{{ incident.title }}</span>
              <span :class="['text-xs font-medium px-1.5 py-0.5 rounded-md shrink-0', STATUS_COLORS[incident.status]]">
                {{ incident.status.replace('_', ' ') }}
              </span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button
                class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-green-500 hover:bg-green-500/10 transition-colors"
                @click="resolveIncident(incident)"
              >
                <CheckCircle2 class="size-3.5" :stroke-width="1.75" />
                {{ incident.type === 'maintenance' ? 'Complete' : 'Resolve' }}
              </button>
              <button class="size-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors" @click="openEditIncident(incident)">
                <svg class="size-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="size-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors" @click="deleteIncident(incident)">
                <Trash2 class="size-3.5 text-muted-foreground" :stroke-width="1.75" />
              </button>
            </div>
          </div>
          <p v-if="incident.body" class="text-xs text-muted-foreground pl-6">{{ incident.body }}</p>
          <p v-if="incident.scheduledAt" class="text-xs text-muted-foreground pl-6">Scheduled: {{ new Date(incident.scheduledAt).toLocaleString() }}</p>
        </div>

        <!-- Resolved/completed (collapsed list) -->
        <details v-if="resolvedIncidents.length > 0" class="rounded-xl border border-border overflow-hidden">
          <summary class="px-4 py-3 text-xs text-muted-foreground cursor-pointer hover:bg-accent transition-colors select-none">
            {{ resolvedIncidents.length }} resolved / completed
          </summary>
          <div class="divide-y divide-border">
            <div v-for="incident in resolvedIncidents" :key="incident.id" class="flex items-center justify-between px-4 py-3 gap-3">
              <div class="flex items-center gap-2 min-w-0">
                <component :is="incident.type === 'maintenance' ? Wrench : AlertTriangle" class="size-3.5 shrink-0 text-muted-foreground/50" :stroke-width="1.75" />
                <span class="text-xs text-muted-foreground truncate">{{ incident.title }}</span>
                <span :class="['text-xs font-medium px-1.5 py-0.5 rounded-md shrink-0', STATUS_COLORS[incident.status]]">
                  {{ incident.status }}
                </span>
              </div>
              <button class="size-6 rounded-lg flex items-center justify-center hover:bg-accent transition-colors shrink-0" @click="deleteIncident(incident)">
                <Trash2 class="size-3 text-muted-foreground" :stroke-width="1.75" />
              </button>
            </div>
          </div>
        </details>
      </div>

      <!-- Checks section -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-medium">Checks <span class="text-muted-foreground font-normal">({{ checks.length }})</span></h2>
          <button
            v-if="availableChecks.length > 0"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors"
            @click="showAddPicker = !showAddPicker"
          >
            <Plus class="size-3.5" :stroke-width="1.75" />
            Add check
          </button>
        </div>

        <div v-if="showAddPicker" class="rounded-xl border border-border bg-card p-4 space-y-2">
          <p class="text-xs text-muted-foreground mb-2">Select a health check to add:</p>
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

        <p v-if="saveError" class="text-xs text-red-500">{{ saveError }}</p>

        <div v-if="checks.length === 0" class="rounded-xl border border-dashed border-border p-8 text-center">
          <p class="text-sm text-muted-foreground">No checks added yet. Add some health checks to display on this page.</p>
        </div>

        <div v-for="(check, i) in checks" :key="check.healthCheckId" class="rounded-xl border border-border bg-card p-5 space-y-4">
          <div class="flex items-start gap-3">
            <div class="flex flex-col gap-1">
              <button class="size-6 rounded flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-30" :disabled="i === 0" @click="moveUp(i)">
                <ChevronUp class="size-3.5 text-muted-foreground" :stroke-width="2" />
              </button>
              <button class="size-6 rounded flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-30" :disabled="i === checks.length - 1" @click="moveDown(i)">
                <ChevronDown class="size-3.5 text-muted-foreground" :stroke-width="2" />
              </button>
            </div>

            <div class="flex-1 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium">{{ check.checkName }}</p>
                  <p class="text-xs text-muted-foreground font-mono">{{ check.checkUrl }}</p>
                </div>
                <button class="size-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors" @click="removeCheck(i)">
                  <Trash2 class="size-3.5 text-muted-foreground" :stroke-width="1.75" />
                </button>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1">
                  <label class="text-xs text-muted-foreground">Display name <span class="text-muted-foreground/50">(optional)</span></label>
                  <input v-model="check.displayName" type="text" :placeholder="check.checkName" :class="INPUT" @change="saveChecks">
                </div>
                <div class="space-y-1">
                  <label class="text-xs text-muted-foreground">Display mode</label>
                  <select v-model="check.displayMode" :class="INPUT" @change="saveChecks">
                    <option v-for="m in DISPLAY_MODES" :key="m.value" :value="m.value">{{ m.label }} — {{ m.desc }}</option>
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

  <!-- Incident modal -->
  <Teleport to="body">
    <div v-if="showIncidentModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50" @click="showIncidentModal = false" />
      <div class="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-6 space-y-5">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">{{ editingIncident ? 'Edit' : 'New' }} {{ incidentForm.type === 'maintenance' ? 'Maintenance' : 'Incident' }}</h3>
          <button class="size-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors" @click="showIncidentModal = false">
            <X class="size-4 text-muted-foreground" :stroke-width="1.75" />
          </button>
        </div>

        <!-- Type toggle (only on new) -->
        <div v-if="!editingIncident" class="flex gap-2">
          <button
            v-for="t in [{ value: 'incident', label: 'Incident', icon: AlertTriangle }, { value: 'maintenance', label: 'Maintenance', icon: Wrench }]"
            :key="t.value"
            class="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium transition-colors"
            :class="incidentForm.type === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'"
            @click="incidentForm.type = t.value as IncidentType; incidentForm.status = t.value === 'maintenance' ? 'scheduled' : 'investigating'"
          >
            <component :is="t.icon" class="size-3.5" :stroke-width="1.75" />
            {{ t.label }}
          </button>
        </div>

        <div class="space-y-1">
          <label class="text-xs text-muted-foreground">Title</label>
          <input v-model="incidentForm.title" type="text" placeholder="Brief summary" :class="INPUT">
        </div>

        <div class="space-y-1">
          <label class="text-xs text-muted-foreground">Message <span class="text-muted-foreground/50">(optional)</span></label>
          <textarea v-model="incidentForm.body" rows="3" placeholder="More detail for visitors..." class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">Status</label>
            <select v-model="incidentForm.status" :class="INPUT">
              <option v-for="s in incidentForm.type === 'maintenance' ? MAINTENANCE_STATUSES : INCIDENT_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </div>
          <div v-if="incidentForm.type === 'maintenance'" class="space-y-1">
            <label class="text-xs text-muted-foreground">Scheduled time</label>
            <input v-model="incidentForm.scheduledAt" type="datetime-local" :class="INPUT">
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <button class="px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent transition-colors" @click="showIncidentModal = false">Cancel</button>
          <button
            :disabled="!incidentForm.title || savingIncident"
            class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            @click="saveIncident"
          >
            {{ savingIncident ? 'Saving...' : editingIncident ? 'Update' : 'Create' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
