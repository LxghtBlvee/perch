<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Globe, Lock,
  AlertTriangle, Wrench, CheckCircle2, X, Upload, RefreshCw,
  ExternalLink, Palette, Monitor,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const hostname = window.location.hostname
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
  themeJson: string | null
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

interface Theme {
  accentColor: string
  bgColor: string
  textColor: string
  fontFamily: string
  customCss: string
}

const FONT_OPTIONS = [
  { value: 'system',   label: 'System default' },
  { value: 'inter',    label: 'Inter' },
  { value: 'dm-sans',  label: 'DM Sans' },
  { value: 'geist',    label: 'Geist' },
  { value: 'jakarta',  label: 'Plus Jakarta Sans' },
  { value: 'mono',     label: 'JetBrains Mono' },
]

const page = ref<PageData | null>(null)
const checks = ref<PageCheck[]>([])
const incidents = ref<Incident[]>([])
const allHealthChecks = ref<HealthCheck[]>([])
const loading = ref(true)
const saving = ref(false)
const savingMeta = ref(false)
const saveError = ref('')
const showAddPicker = ref(false)

const theme = ref<Theme>({ accentColor: '#7dd3c0', bgColor: '', textColor: '', fontFamily: 'system', customCss: '' })
const savingTheme = ref(false)
const showPreview = ref(false)

// Logo upload
const logoFileInput = ref<HTMLInputElement | null>(null)
const uploadingLogo = ref(false)

// Domain verify
const verifying = ref(false)
const verifyResult = ref<{ addresses: string[]; verified: boolean; error?: string } | null>(null)

// Incident modal
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
      description: data.description ?? null, logoUrl: data.logoUrl ?? null,
      customDomain: data.customDomain ?? null, themeJson: data.themeJson ?? null,
    }
    checks.value = data.checks.map(c => ({
      id: c.id, healthCheckId: c.healthCheckId, checkName: c.checkName,
      checkUrl: c.checkUrl, displayName: c.displayName ?? '', displayMode: c.displayMode, showUrl: c.showUrl,
    }))
    if (data.themeJson) {
      try { Object.assign(theme.value, JSON.parse(data.themeJson)) } catch { /* ignore invalid JSON */ }
    }
  }

  if (allChecksRes.ok) allHealthChecks.value = await allChecksRes.json() as HealthCheck[]
  if (incidentsRes.ok) incidents.value = await incidentsRes.json() as Incident[]

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
      customDomain: page.value.customDomain || null,
    }),
  })
  savingMeta.value = false
  if (res.ok) { toast.success('Settings saved') }
  else {
    const d = await res.json() as { error?: string }
    toast.error(d.error ?? 'Failed to save settings')
  }
}

async function onLogoSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !page.value) return
  uploadingLogo.value = true
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/api/admin/status-pages/${pageId}/logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}` },
    body: form,
  })
  uploadingLogo.value = false
  if (res.ok) {
    const { logoUrl } = await res.json() as { logoUrl: string }
    page.value.logoUrl = logoUrl
    toast.success('Logo uploaded')
  } else {
    const d = await res.json() as { error?: string }
    toast.error(d.error ?? 'Failed to upload logo')
  }
  if (logoFileInput.value) logoFileInput.value.value = ''
}

async function verifyDomain() {
  if (!page.value?.customDomain) return
  verifying.value = true
  verifyResult.value = null
  try {
    const params = new URLSearchParams({ domain: page.value.customDomain })
    const res = await fetch(`/api/admin/status-pages/${pageId}/verify-domain?${params}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    const data = await res.json() as { addresses: string[]; verified: boolean; error?: string }
    verifyResult.value = data
    if (data.verified) toast.success('DNS verified — domain resolves correctly')
    else toast.warning(data.error ?? 'Domain does not resolve yet')
  } catch {
    toast.error('Verification request failed — please try again')
  } finally {
    verifying.value = false
  }
}

async function saveTheme() {
  if (!page.value) return
  savingTheme.value = true
  const themeJson = JSON.stringify(theme.value)
  const res = await fetch(`/api/admin/status-pages/${pageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ themeJson }),
  })
  savingTheme.value = false
  if (res.ok) { if (page.value) page.value.themeJson = themeJson; toast.success('Theme saved') }
  else toast.error('Failed to save theme')
}

async function saveChecks() {
  saving.value = true
  saveError.value = ''
  const res = await fetch(`/api/admin/status-pages/${pageId}/checks`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({
      checks: checks.value.map(c => ({
        healthCheckId: c.healthCheckId, displayName: c.displayName || undefined,
        displayMode: c.displayMode, showUrl: c.showUrl,
      }))
    }),
  })
  saving.value = false
  if (!res.ok) {
    const data = await res.json() as { error?: string }
    saveError.value = data.error ?? 'Save failed'
    toast.error(data.error ?? 'Failed to save checks')
  }
}

function addCheck(hc: HealthCheck) {
  checks.value.push({ healthCheckId: hc.id, checkName: hc.name, checkUrl: hc.url, displayName: '', displayMode: 'full_history', showUrl: false })
  showAddPicker.value = false
  saveChecks()
}
function removeCheck(i: number) { checks.value.splice(i, 1); saveChecks() }
function moveUp(i: number) { if (i === 0) return; [checks.value[i - 1], checks.value[i]] = [checks.value[i], checks.value[i - 1]]; saveChecks() }
function moveDown(i: number) { if (i === checks.value.length - 1) return; [checks.value[i], checks.value[i + 1]] = [checks.value[i + 1], checks.value[i]]; saveChecks() }

function openNewIncident() {
  editingIncident.value = null
  incidentForm.value = { type: 'incident', title: '', body: '', status: 'investigating', scheduledAt: '' }
  showIncidentModal.value = true
}

function openEditIncident(incident: Incident) {
  editingIncident.value = incident
  incidentForm.value = { type: incident.type, title: incident.title, body: incident.body, status: incident.status, scheduledAt: incident.scheduledAt ? incident.scheduledAt.slice(0, 16) : '' }
  showIncidentModal.value = true
}

async function saveIncident() {
  savingIncident.value = true
  const payload = { type: incidentForm.value.type, title: incidentForm.value.title, body: incidentForm.value.body, status: incidentForm.value.status, scheduledAt: incidentForm.value.scheduledAt || null }
  const res = editingIncident.value
    ? await fetch(`/api/admin/status-pages/${pageId}/incidents/${editingIncident.value.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }, body: JSON.stringify(payload) })
    : await fetch(`/api/admin/status-pages/${pageId}/incidents`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }, body: JSON.stringify(payload) })

  if (res.ok) {
    const updated = await res.json() as Incident
    if (editingIncident.value) {
      const idx = incidents.value.findIndex(i => i.id === updated.id)
      if (idx !== -1) incidents.value[idx] = updated
      toast.success('Incident updated')
    } else {
      incidents.value.unshift(updated)
      toast.success('Incident created')
    }
    showIncidentModal.value = false
  } else {
    toast.error('Failed to save incident')
  }
  savingIncident.value = false
}

async function resolveIncident(incident: Incident) {
  const resolveStatus = incident.type === 'maintenance' ? 'completed' : 'resolved'
  const res = await fetch(`/api/admin/status-pages/${pageId}/incidents/${incident.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ status: resolveStatus }),
  })
  if (res.ok) {
    const updated = await res.json() as Incident
    const idx = incidents.value.findIndex(i => i.id === incident.id)
    if (idx !== -1) incidents.value[idx] = updated
    toast.success(incident.type === 'maintenance' ? 'Marked as completed' : 'Incident resolved')
  } else toast.error('Failed to resolve incident')
}

async function deleteIncident(incident: Incident) {
  const res = await fetch(`/api/admin/status-pages/${pageId}/incidents/${incident.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } })
  if (res.ok) { incidents.value = incidents.value.filter(i => i.id !== incident.id); toast.success('Incident deleted') }
  else toast.error('Failed to delete incident')
}

const INCIDENT_STATUSES: { value: IncidentStatus; label: string }[] = [
  { value: 'investigating', label: 'Investigating' }, { value: 'identified', label: 'Identified' },
  { value: 'monitoring', label: 'Monitoring' }, { value: 'resolved', label: 'Resolved' },
]
const MAINTENANCE_STATUSES: { value: IncidentStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' }, { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' },
]
const STATUS_COLORS: Record<IncidentStatus, string> = {
  investigating: 'text-red-500 bg-red-500/10', identified: 'text-amber-500 bg-amber-500/10',
  monitoring: 'text-blue-500 bg-blue-500/10', resolved: 'text-green-500 bg-green-500/10',
  scheduled: 'text-sky-500 bg-sky-500/10', in_progress: 'text-amber-500 bg-amber-500/10', completed: 'text-green-500 bg-green-500/10',
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
    <!-- Header -->
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
      class="space-y-4"
    >
      <div class="rounded-xl border border-border bg-card p-5 space-y-4 animate-pulse">
        <div class="h-3.5 w-24 bg-muted rounded" />
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <div class="h-3 w-12 bg-muted rounded" />
            <div class="h-9 bg-muted rounded-lg" />
          </div>
          <div class="space-y-2">
            <div class="h-3 w-10 bg-muted rounded" />
            <div class="h-9 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
      <div class="rounded-xl border border-border bg-card p-5 space-y-3 animate-pulse">
        <div class="h-3.5 w-32 bg-muted rounded" />
        <div
          v-for="i in 3"
          :key="i"
          class="h-14 bg-muted rounded-xl"
        />
      </div>
    </div>

    <template v-else-if="page">
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
          <div
            class="space-y-1 transition-opacity"
            :class="page.customDomain ? 'opacity-40 pointer-events-none select-none' : ''"
          >
            <label class="text-xs text-muted-foreground">
              Slug
              <span
                v-if="page.customDomain"
                class="ml-1"
              >(overridden by custom domain)</span>
            </label>
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground shrink-0">/status/</span>
              <input
                v-model="page.slug"
                type="text"
                :class="INPUT"
              >
            </div>
          </div>
          <div class="space-y-1 col-span-2">
            <label class="text-xs text-muted-foreground">Description <span class="text-muted-foreground/50">(shown on public page)</span></label>
            <input
              v-model="page.description"
              type="text"
              placeholder="Brief description of your services"
              :class="INPUT"
            >
          </div>
        </div>

        <!-- Logo -->
        <div class="space-y-2">
          <label class="text-xs text-muted-foreground">Logo</label>
          <div class="flex items-center gap-3">
            <div class="size-12 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
              <img
                v-if="page.logoUrl"
                :src="page.logoUrl"
                alt="Logo"
                class="size-full object-contain p-1"
              >
              <Globe
                v-else
                class="size-5 text-muted-foreground/40"
                :stroke-width="1.5"
              />
            </div>
            <div class="space-y-1">
              <button
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
                :disabled="uploadingLogo"
                @click="logoFileInput?.click()"
              >
                <Upload
                  v-if="!uploadingLogo"
                  class="size-3.5"
                  :stroke-width="1.75"
                />
                <RefreshCw
                  v-else
                  class="size-3.5 animate-spin"
                  :stroke-width="1.75"
                />
                {{ uploadingLogo ? 'Uploading...' : page.logoUrl ? 'Replace logo' : 'Upload logo' }}
              </button>
              <p class="text-xs text-muted-foreground/60">
                PNG, JPG, GIF, WebP · max 2 MB
              </p>
            </div>
            <input
              ref="logoFileInput"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              class="hidden"
              @change="onLogoSelected"
            >
          </div>
        </div>

        <!-- Custom domain -->
        <div class="space-y-2">
          <label class="text-xs text-muted-foreground">Custom domain <span class="text-muted-foreground/50">(optional)</span></label>
          <div class="flex items-center gap-2">
            <input
              v-model="page.customDomain"
              type="text"
              placeholder="status.example.com"
              :class="INPUT"
            >
            <button
              v-if="page.customDomain"
              class="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
              :disabled="verifying"
              @click="verifyDomain"
            >
              <RefreshCw
                v-if="verifying"
                class="size-3 animate-spin"
                :stroke-width="1.75"
              />
              {{ verifying ? 'Checking...' : 'Verify DNS' }}
            </button>
          </div>

          <!-- DNS instructions -->
          <div
            v-if="page.customDomain"
            class="rounded-lg border border-border bg-muted/30 p-3 space-y-2"
          >
            <p class="text-xs font-medium">
              DNS record required
            </p>
            <div class="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span class="text-muted-foreground">Type</span><p class="font-mono mt-0.5">
                  CNAME
                </p>
              </div>
              <div>
                <span class="text-muted-foreground">Name</span><p class="font-mono mt-0.5">
                  {{ page.customDomain.split('.').slice(0, -2).join('.') || '@' }}
                </p>
              </div>
              <div>
                <span class="text-muted-foreground">Value</span><p class="font-mono mt-0.5 truncate">
                  {{ hostname }}
                </p>
              </div>
            </div>
            <div
              v-if="verifyResult"
              class="flex items-center gap-2 mt-1"
            >
              <span
                v-if="verifyResult.verified"
                class="text-xs text-green-500 font-medium"
              >✓ DNS verified</span>
              <span
                v-else
                class="text-xs text-amber-500"
              >{{ verifyResult.error ?? 'Not resolved yet' }}</span>
              <span
                v-if="verifyResult.addresses.length"
                class="text-xs text-muted-foreground"
              >→ {{ verifyResult.addresses.join(', ') }}</span>
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
            class="px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
            @click="saveMeta"
          >
            {{ savingMeta ? 'Saving...' : 'Save' }}
          </button>
          <a
            :href="page.customDomain ? `https://${page.customDomain}` : `/status/${page.slug}`"
            target="_blank"
            class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Preview <ExternalLink
              class="size-3"
              :stroke-width="1.75"
            />
          </a>
          <button
            class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
            @click="showPreview = !showPreview"
          >
            <Monitor
              class="size-3.5"
              :stroke-width="1.75"
            />
            {{ showPreview ? 'Hide preview' : 'Inline preview' }}
          </button>
        </div>
      </div>

      <div
        v-if="showPreview"
        class="rounded-xl border border-border overflow-hidden"
      >
        <div class="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border">
          <div class="flex gap-1.5">
            <div class="size-2.5 rounded-full bg-red-400/60" />
            <div class="size-2.5 rounded-full bg-amber-400/60" />
            <div class="size-2.5 rounded-full bg-green-400/60" />
          </div>
          <span class="text-xs text-muted-foreground font-mono flex-1 text-center">/status/{{ page.slug }}</span>
        </div>
        <iframe
          :src="`/status/${page.slug}`"
          class="w-full h-96 border-0"
          title="Status page preview"
        />
      </div>

      <div class="rounded-xl border border-border bg-card p-5 space-y-5">
        <div class="flex items-center gap-2">
          <Palette
            class="size-4 text-muted-foreground"
            :stroke-width="1.75"
          />
          <h2 class="text-sm font-medium">
            Design
          </h2>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-xs text-muted-foreground">Accent color</label>
            <div class="flex items-center gap-2">
              <input
                v-model="theme.accentColor"
                type="color"
                class="size-8 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
              >
              <input
                v-model="theme.accentColor"
                type="text"
                placeholder="#7dd3c0"
                class="flex-1 px-2 py-1.5 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="text-xs text-muted-foreground">Background color <span class="text-muted-foreground/50">(leave blank for default)</span></label>
            <div class="flex items-center gap-2">
              <input
                v-model="theme.bgColor"
                type="color"
                class="size-8 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
              >
              <input
                v-model="theme.bgColor"
                type="text"
                placeholder="#0f1117"
                class="flex-1 px-2 py-1.5 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="text-xs text-muted-foreground">Text color <span class="text-muted-foreground/50">(leave blank for default)</span></label>
            <div class="flex items-center gap-2">
              <input
                v-model="theme.textColor"
                type="color"
                class="size-8 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
              >
              <input
                v-model="theme.textColor"
                type="text"
                placeholder="#f1f5f9"
                class="flex-1 px-2 py-1.5 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="text-xs text-muted-foreground">Font</label>
            <select
              v-model="theme.fontFamily"
              class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option
                v-for="f in FONT_OPTIONS"
                :key="f.value"
                :value="f.value"
              >
                {{ f.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs text-muted-foreground">Custom CSS <span class="text-muted-foreground/50">(applied to #sp-root)</span></label>
          <textarea
            v-model="theme.customCss"
            rows="4"
            placeholder="/* e.g. .rounded-xl { border-radius: 0.25rem; } */"
            class="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
        </div>

        <button
          :disabled="savingTheme"
          class="px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
          @click="saveTheme"
        >
          {{ savingTheme ? 'Saving...' : 'Save design' }}
        </button>
      </div>

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-medium">
            Incidents & Maintenance
          </h2>
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors"
            @click="openNewIncident"
          >
            <Plus
              class="size-3.5"
              :stroke-width="1.75"
            />
            New
          </button>
        </div>

        <div
          v-if="activeIncidents.length === 0 && resolvedIncidents.length === 0"
          class="rounded-xl border border-dashed border-border p-6 text-center"
        >
          <p class="text-sm text-muted-foreground">
            No incidents or maintenance windows. Nice.
          </p>
        </div>

        <div
          v-for="incident in activeIncidents"
          :key="incident.id"
          class="rounded-xl border border-border bg-card p-4 space-y-2"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2 min-w-0">
              <component
                :is="incident.type === 'maintenance' ? Wrench : AlertTriangle"
                class="size-4 shrink-0 text-muted-foreground"
                :stroke-width="1.75"
              />
              <span class="text-sm font-medium truncate">{{ incident.title }}</span>
              <span :class="['text-xs font-medium px-1.5 py-0.5 rounded-md shrink-0', STATUS_COLORS[incident.status]]">{{ incident.status.replace('_', ' ') }}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button
                class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-green-500 hover:bg-green-500/10 transition-colors"
                @click="resolveIncident(incident)"
              >
                <CheckCircle2
                  class="size-3.5"
                  :stroke-width="1.75"
                />
                {{ incident.type === 'maintenance' ? 'Complete' : 'Resolve' }}
              </button>
              <button
                class="size-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
                @click="openEditIncident(incident)"
              >
                <svg
                  class="size-3.5 text-muted-foreground"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                class="size-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
                @click="deleteIncident(incident)"
              >
                <Trash2
                  class="size-3.5 text-muted-foreground"
                  :stroke-width="1.75"
                />
              </button>
            </div>
          </div>
          <p
            v-if="incident.body"
            class="text-xs text-muted-foreground pl-6"
          >
            {{ incident.body }}
          </p>
          <p
            v-if="incident.scheduledAt"
            class="text-xs text-muted-foreground pl-6"
          >
            Scheduled: {{ new Date(incident.scheduledAt).toLocaleString() }}
          </p>
        </div>

        <details
          v-if="resolvedIncidents.length > 0"
          class="rounded-xl border border-border overflow-hidden"
        >
          <summary class="px-4 py-3 text-xs text-muted-foreground cursor-pointer hover:bg-accent transition-colors select-none">
            {{ resolvedIncidents.length }} resolved / completed
          </summary>
          <div class="divide-y divide-border">
            <div
              v-for="incident in resolvedIncidents"
              :key="incident.id"
              class="flex items-center justify-between px-4 py-3 gap-3"
            >
              <div class="flex items-center gap-2 min-w-0">
                <component
                  :is="incident.type === 'maintenance' ? Wrench : AlertTriangle"
                  class="size-3.5 shrink-0 text-muted-foreground/50"
                  :stroke-width="1.75"
                />
                <span class="text-xs text-muted-foreground truncate">{{ incident.title }}</span>
                <span :class="['text-xs font-medium px-1.5 py-0.5 rounded-md shrink-0', STATUS_COLORS[incident.status]]">{{ incident.status }}</span>
              </div>
              <button
                class="size-6 rounded-lg flex items-center justify-center hover:bg-accent transition-colors shrink-0"
                @click="deleteIncident(incident)"
              >
                <Trash2
                  class="size-3 text-muted-foreground"
                  :stroke-width="1.75"
                />
              </button>
            </div>
          </div>
        </details>
      </div>

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
            No checks added yet.
          </p>
        </div>

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

  <Teleport to="body">
    <div
      v-if="showIncidentModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        class="absolute inset-0 bg-black/50"
        @click="showIncidentModal = false"
      />
      <div class="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-6 space-y-5">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">
            {{ editingIncident ? 'Edit' : 'New' }} {{ incidentForm.type === 'maintenance' ? 'Maintenance' : 'Incident' }}
          </h3>
          <button
            class="size-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
            @click="showIncidentModal = false"
          >
            <X
              class="size-4 text-muted-foreground"
              :stroke-width="1.75"
            />
          </button>
        </div>

        <div
          v-if="!editingIncident"
          class="flex gap-2"
        >
          <button
            v-for="t in [{ value: 'incident', label: 'Incident', icon: AlertTriangle }, { value: 'maintenance', label: 'Maintenance', icon: Wrench }]"
            :key="t.value"
            class="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium transition-colors"
            :class="incidentForm.type === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'"
            @click="incidentForm.type = t.value as IncidentType; incidentForm.status = t.value === 'maintenance' ? 'scheduled' : 'investigating'"
          >
            <component
              :is="t.icon"
              class="size-3.5"
              :stroke-width="1.75"
            />
            {{ t.label }}
          </button>
        </div>

        <div class="space-y-1">
          <label class="text-xs text-muted-foreground">Title</label>
          <input
            v-model="incidentForm.title"
            type="text"
            placeholder="Brief summary"
            :class="INPUT"
          >
        </div>

        <div class="space-y-1">
          <label class="text-xs text-muted-foreground">Message <span class="text-muted-foreground/50">(optional)</span></label>
          <textarea
            v-model="incidentForm.body"
            rows="3"
            placeholder="More detail for visitors..."
            class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">Status</label>
            <select
              v-model="incidentForm.status"
              :class="INPUT"
            >
              <option
                v-for="s in incidentForm.type === 'maintenance' ? MAINTENANCE_STATUSES : INCIDENT_STATUSES"
                :key="s.value"
                :value="s.value"
              >
                {{ s.label }}
              </option>
            </select>
          </div>
          <div
            v-if="incidentForm.type === 'maintenance'"
            class="space-y-1"
          >
            <label class="text-xs text-muted-foreground">Scheduled time</label>
            <input
              v-model="incidentForm.scheduledAt"
              type="datetime-local"
              :class="INPUT"
            >
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <button
            class="px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent transition-colors"
            @click="showIncidentModal = false"
          >
            Cancel
          </button>
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
