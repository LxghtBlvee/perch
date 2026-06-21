<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Plus, Trash2, Bell, Webhook, Send, CheckCircle, XCircle, Loader,
  ToggleLeft, ToggleRight, Pencil, ChevronDown, ChevronUp, History,
} from 'lucide-vue-next'
import type {
  AlertDestination, AlertDestinationType,
  AlertRule, AlertRuleType, HealthCheckTrigger, ContainerEventType,
  HealthCheck,
} from '@perch/types'
import { usePerchStore } from '@/stores/perch'
import { useApi } from '@/composables/useApi'
import { useCache } from '@/composables/useCache'
import { useAuthStore } from '@/stores/auth'
import Tooltip from '@/components/Tooltip.vue'

const store = usePerchStore()
const auth = useAuthStore()
const { apiFetch, cachedFetch } = useApi()
const { invalidate } = useCache()

const DEST_CACHE_KEY = '/api/alerts/destinations'
const RULES_CACHE_KEY = '/api/alerts/rules'
const HC_CACHE_KEY = '/api/health-checks'

const destinations = ref<AlertDestination[]>([])
const rules = ref<AlertRule[]>([])
const history = ref<{ id: string; ruleId: string; triggeredAt: string; detail: string; status: 'sent' | 'failed'; error: string | null }[]>([])
const healthChecks = ref<HealthCheck[]>([])
const loading = ref(true)
const showHistory = ref(false)

const showDestModal = ref(false)
const editingDest = ref<AlertDestination | null>(null)
const destSaving = ref(false)
const destError = ref('')
const testState = ref<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>({})

const defaultDestForm = () => ({
  name: '',
  type: 'discord' as AlertDestinationType,
  webhookUrl: '',
  ntfyTopic: '',
  ntfyPriority: 'default',
})
const destForm = ref(defaultDestForm())

function openAddDest() {
  editingDest.value = null
  destForm.value = defaultDestForm()
  destError.value = ''
  showDestModal.value = true
}

function openEditDest(d: AlertDestination) {
  editingDest.value = d
  destForm.value = {
    name: d.name,
    type: d.type,
    webhookUrl: d.webhookUrl,
    ntfyTopic: d.ntfyTopic ?? '',
    ntfyPriority: d.ntfyPriority ?? 'default',
  }
  destError.value = ''
  showDestModal.value = true
}

async function saveDest() {
  destError.value = ''
  if (!destForm.value.name.trim() || !destForm.value.webhookUrl.trim()) {
    destError.value = 'Name and Webhook URL are required.'
    return
  }
  if (destForm.value.type === 'ntfy' && !destForm.value.ntfyTopic.trim()) {
    destError.value = 'ntfy Topic is required.'
    return
  }
  destSaving.value = true
  try {
    const payload = {
      name: destForm.value.name,
      type: destForm.value.type,
      webhookUrl: destForm.value.webhookUrl,
      ntfyTopic: destForm.value.type === 'ntfy' ? destForm.value.ntfyTopic : undefined,
      ntfyPriority: destForm.value.type === 'ntfy' ? destForm.value.ntfyPriority : undefined,
    }
    if (editingDest.value) {
      const res = await apiFetch(`/api/alerts/destinations/${editingDest.value.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated: AlertDestination = await res.json()
      const idx = destinations.value.findIndex(d => d.id === updated.id)
      if (idx !== -1) destinations.value[idx] = updated
    } else {
      const res = await apiFetch('/api/alerts/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      destinations.value.push(await res.json())
    }
    invalidate(DEST_CACHE_KEY)
    showDestModal.value = false
  } catch (e) {
    destError.value = String(e)
  } finally {
    destSaving.value = false
  }
}

async function deleteDest(id: string) {
  const prev = [...destinations.value]
  destinations.value = destinations.value.filter(d => d.id !== id)
  invalidate(DEST_CACHE_KEY)
  try {
    const res = await apiFetch(`/api/alerts/destinations/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error()
  } catch {
    destinations.value = prev
  }
}

async function testDest(id: string) {
  testState.value[id] = 'testing'
  try {
    const res = await apiFetch(`/api/alerts/destinations/${id}/test`, { method: 'POST' })
    const data = await res.json()
    testState.value[id] = data.ok ? 'ok' : 'fail'
  } catch {
    testState.value[id] = 'fail'
  }
  setTimeout(() => { testState.value[id] = 'idle' }, 5000)
}

const showRuleModal = ref(false)
const editingRule = ref<AlertRule | null>(null)
const ruleSaving = ref(false)
const ruleError = ref('')

const defaultRuleForm = () => ({
  name: '',
  type: 'health_check' as AlertRuleType,
  destinationId: '',
  cooldown: 300,
  // health_check
  healthCheckId: '' as string,
  onStatus: 'both' as HealthCheckTrigger,
  // container_event
  agentId: '' as string,
  events: ['crash'] as ContainerEventType[],
})
const ruleForm = ref(defaultRuleForm())

const agents = computed(() => store.agents.map(a => a.agent))

function openAddRule() {
  editingRule.value = null
  ruleForm.value = defaultRuleForm()
  ruleError.value = ''
  showRuleModal.value = true
}

function openEditRule(r: AlertRule) {
  editingRule.value = r
  ruleForm.value = {
    name: r.name,
    type: r.type,
    destinationId: r.destinationId,
    cooldown: r.cooldown,
    healthCheckId: r.healthCheckId ?? '',
    onStatus: r.onStatus ?? 'both',
    agentId: r.agentId ?? '',
    events: r.events ?? ['crash'],
  }
  ruleError.value = ''
  showRuleModal.value = true
}

function toggleEvent(event: ContainerEventType) {
  const idx = ruleForm.value.events.indexOf(event)
  if (idx === -1) ruleForm.value.events.push(event)
  else ruleForm.value.events.splice(idx, 1)
}

async function saveRule() {
  ruleError.value = ''
  if (!ruleForm.value.name.trim()) { ruleError.value = 'Name is required.'; return }
  if (!ruleForm.value.destinationId) { ruleError.value = 'Select a destination.'; return }
  if (ruleForm.value.type === 'container_event' && ruleForm.value.events.length === 0) {
    ruleError.value = 'Select at least one event.'; return
  }
  ruleSaving.value = true
  try {
    const payload: Record<string, unknown> = {
      name: ruleForm.value.name,
      type: ruleForm.value.type,
      destinationId: ruleForm.value.destinationId,
      cooldown: ruleForm.value.cooldown,
    }
    if (ruleForm.value.type === 'health_check') {
      payload.healthCheckId = ruleForm.value.healthCheckId || undefined
      payload.onStatus = ruleForm.value.onStatus
    } else {
      payload.agentId = ruleForm.value.agentId || undefined
      payload.events = ruleForm.value.events
    }

    let res: Response
    if (editingRule.value) {
      res = await apiFetch(`/api/alerts/rules/${editingRule.value.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      res = await apiFetch('/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    if (!res.ok) throw new Error(await res.text())
    // refresh rules to get denormalized destination info
    invalidate(RULES_CACHE_KEY)
    await fetchRules()
    showRuleModal.value = false
  } catch (e) {
    ruleError.value = String(e)
  } finally {
    ruleSaving.value = false
  }
}

async function toggleRule(id: string) {
  const idx = rules.value.findIndex(r => r.id === id)
  if (idx === -1) return
  const prevEnabled = rules.value[idx].enabled
  rules.value[idx] = { ...rules.value[idx], enabled: !prevEnabled }
  try {
    const res = await apiFetch(`/api/alerts/rules/${id}/toggle`, { method: 'PATCH' })
    if (!res.ok) throw new Error()
    const updated: AlertRule = await res.json()
    rules.value[idx] = updated
  } catch {
    rules.value[idx] = { ...rules.value[idx], enabled: prevEnabled }
  }
}

async function deleteRule(id: string) {
  const prev = [...rules.value]
  rules.value = rules.value.filter(r => r.id !== id)
  invalidate(RULES_CACHE_KEY)
  try {
    const res = await apiFetch(`/api/alerts/rules/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error()
  } catch {
    rules.value = prev
  }
}

async function fetchRules() {
  rules.value = await cachedFetch<AlertRule[]>(RULES_CACHE_KEY, 30_000)
}

async function fetchHistory() {
  const res = await apiFetch('/api/alerts/history?limit=50')
  history.value = await res.json()
}

onMounted(async () => {
  loading.value = true
  try {
    const [dests, hcs] = await Promise.all([
      cachedFetch<AlertDestination[]>(DEST_CACHE_KEY, 30_000),
      cachedFetch<HealthCheck[]>(HC_CACHE_KEY, 30_000),
    ])
    destinations.value = dests
    healthChecks.value = hcs
    await fetchRules()
  } finally {
    loading.value = false
  }
})

const DEST_META: Record<AlertDestinationType, { label: string; color: string; bg: string }> = {
  discord: { label: 'Discord', color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
  slack:   { label: 'Slack',   color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  ntfy:    { label: 'ntfy',    color: 'text-sky-400',    bg: 'bg-sky-400/10'    },
}

function formatCooldown(s: number) {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
</script>

<template>
  <div class="p-6 space-y-8">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          Alerts
        </h1>
        <p class="text-sm text-muted-foreground mt-0.5">
          Send notifications to Discord, Slack, or ntfy when things go wrong.
        </p>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div
      v-if="loading"
      class="space-y-6"
    >
      <!-- Destinations section -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="h-3 w-24 bg-muted rounded animate-pulse" />
          <div class="h-7 w-28 bg-muted rounded-lg animate-pulse" />
        </div>
        <div
          v-for="i in 2"
          :key="`d${i}`"
          class="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
        >
          <div class="size-10 rounded-lg bg-muted animate-pulse shrink-0" />
          <div class="flex-1 space-y-2">
            <div class="h-3.5 w-32 bg-muted rounded animate-pulse" />
            <div class="h-3 w-48 bg-muted rounded animate-pulse" />
          </div>
          <div class="h-7 w-16 bg-muted rounded-lg animate-pulse" />
          <div class="size-8 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
      <!-- Rules section -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="h-3 w-16 bg-muted rounded animate-pulse" />
          <div class="h-7 w-20 bg-muted rounded-lg animate-pulse" />
        </div>
        <div
          v-for="i in 2"
          :key="`r${i}`"
          class="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
        >
          <div class="size-8 rounded-lg bg-muted animate-pulse shrink-0" />
          <div class="flex-1 space-y-2">
            <div class="h-3.5 w-40 bg-muted rounded animate-pulse" />
            <div class="h-3 w-56 bg-muted rounded animate-pulse" />
          </div>
          <div class="h-5 w-9 bg-muted rounded-full animate-pulse" />
          <div class="size-8 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    </div>

    <template v-else>
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
            Destinations
          </h2>
          <button
            v-if="auth.isAdmin"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            @click="openAddDest"
          >
            <Plus
              class="size-3.5"
              :stroke-width="2"
            />
            Add destination
          </button>
        </div>

        <div
          v-if="destinations.length === 0"
          class="rounded-xl border border-dashed border-border p-10 flex flex-col items-center gap-3 text-center"
        >
          <Webhook
            class="size-8 text-muted-foreground/30"
            :stroke-width="1.25"
          />
          <p class="text-sm text-muted-foreground">
            No destinations yet — add a Discord, Slack, or ntfy webhook.
          </p>
        </div>

        <div
          v-for="dest in destinations"
          :key="dest.id"
          class="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
        >
          <div :class="['size-9 rounded-lg flex items-center justify-center shrink-0', DEST_META[dest.type].bg]">
            <Webhook
              :class="['size-4', DEST_META[dest.type].color]"
              :stroke-width="1.75"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="font-semibold text-sm">
                {{ dest.name }}
              </p>
              <span :class="['text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide', DEST_META[dest.type].color, DEST_META[dest.type].bg]">
                {{ DEST_META[dest.type].label }}
              </span>
            </div>
            <p class="text-xs font-mono text-muted-foreground truncate mt-0.5">
              {{ dest.webhookUrl }}{{ dest.ntfyTopic ? ` / ${dest.ntfyTopic}` : '' }}
            </p>
          </div>

          <!-- Test -->
          <button
            class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors shrink-0"
            :class="{ 'opacity-50 pointer-events-none': testState[dest.id] === 'testing' }"
            @click="testDest(dest.id)"
          >
            <Loader
              v-if="testState[dest.id] === 'testing'"
              class="size-3 animate-spin"
            />
            <CheckCircle
              v-else-if="testState[dest.id] === 'ok'"
              class="size-3 text-green-400"
            />
            <XCircle
              v-else-if="testState[dest.id] === 'fail'"
              class="size-3 text-red-400"
            />
            <Send
              v-else
              class="size-3"
            />
            {{ testState[dest.id] === 'testing' ? 'Sending…'
              : testState[dest.id] === 'ok' ? 'Sent!'
                : testState[dest.id] === 'fail' ? 'Failed'
                  : 'Test' }}
          </button>

          <!-- Edit -->
          <Tooltip
            v-if="auth.isAdmin"
            text="Edit destination"
          >
            <button
              class="size-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors shrink-0"
              @click="openEditDest(dest)"
            >
              <Pencil
                class="size-3.5"
                :stroke-width="1.75"
              />
            </button>
          </Tooltip>

          <!-- Delete -->
          <Tooltip
            v-if="auth.isAdmin"
            text="Delete destination"
          >
            <button
              class="size-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors shrink-0"
              @click="deleteDest(dest.id)"
            >
              <Trash2
                class="size-3.5"
                :stroke-width="2"
              />
            </button>
          </Tooltip>
        </div>
      </section>

      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
            Rules
          </h2>
          <button
            v-if="auth.isAdmin"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            :disabled="destinations.length === 0"
            :class="{ 'opacity-40 pointer-events-none': destinations.length === 0 }"
            @click="openAddRule"
          >
            <Plus
              class="size-3.5"
              :stroke-width="2"
            />
            Add rule
          </button>
        </div>

        <div
          v-if="destinations.length === 0"
          class="rounded-xl border border-dashed border-border p-6"
        >
          <p class="text-xs text-center text-muted-foreground">
            Add a destination first before creating rules.
          </p>
        </div>

        <div
          v-else-if="rules.length === 0"
          class="rounded-xl border border-dashed border-border p-10 flex flex-col items-center gap-3 text-center"
        >
          <Bell
            class="size-8 text-muted-foreground/30"
            :stroke-width="1.25"
          />
          <p class="text-sm text-muted-foreground">
            No alert rules yet.
          </p>
        </div>

        <div
          v-for="rule in rules"
          :key="rule.id"
          class="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
          :class="{ 'opacity-60': !rule.enabled }"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="font-semibold text-sm">
                {{ rule.name }}
              </p>
              <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide bg-muted text-muted-foreground">
                {{ rule.type === 'health_check' ? 'Health Check' : 'Container Event' }}
              </span>
              <span :class="['text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide', DEST_META[rule.destination.type].color, DEST_META[rule.destination.type].bg]">
                {{ rule.destination.name }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">
              <template v-if="rule.type === 'health_check'">
                Trigger: {{ rule.onStatus === 'both' ? 'up & down' : rule.onStatus }}
                {{ rule.healthCheckId ? '' : ' (all checks)' }}
              </template>
              <template v-else>
                Events: {{ (rule.events ?? ['crash']).join(', ') }}
                {{ rule.agentId ? '' : ' (all agents)' }}
              </template>
              &nbsp;·&nbsp;Cooldown: {{ formatCooldown(rule.cooldown) }}
              <span
                v-if="rule.lastFiredAt"
                class="ml-1 text-muted-foreground/60"
              >
                · Last fired {{ timeAgo(rule.lastFiredAt) }}
              </span>
            </p>
          </div>

          <!-- Toggle -->
          <Tooltip
            v-if="auth.isAdmin"
            :text="rule.enabled ? 'Disable rule' : 'Enable rule'"
          >
            <button
              class="shrink-0 text-muted-foreground hover:text-primary transition-colors"
              @click="toggleRule(rule.id)"
            >
              <ToggleRight
                v-if="rule.enabled"
                class="size-5 text-primary"
                :stroke-width="1.75"
              />
              <ToggleLeft
                v-else
                class="size-5"
                :stroke-width="1.75"
              />
            </button>
          </Tooltip>

          <!-- Edit -->
          <Tooltip
            v-if="auth.isAdmin"
            text="Edit rule"
          >
            <button
              class="size-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors shrink-0"
              @click="openEditRule(rule)"
            >
              <Pencil
                class="size-3.5"
                :stroke-width="1.75"
              />
            </button>
          </Tooltip>

          <!-- Delete -->
          <Tooltip
            v-if="auth.isAdmin"
            text="Delete rule"
          >
            <button
              class="size-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors shrink-0"
              @click="deleteRule(rule.id)"
            >
              <Trash2
                class="size-3.5"
                :stroke-width="2"
              />
            </button>
          </Tooltip>
        </div>
      </section>

      <section class="space-y-3">
        <button
          class="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
          @click="async () => { showHistory = !showHistory; if (showHistory) await fetchHistory() }"
        >
          <History
            class="size-4"
            :stroke-width="1.75"
          />
          Alert History
          <ChevronDown
            v-if="!showHistory"
            class="size-4"
          />
          <ChevronUp
            v-else
            class="size-4"
          />
        </button>

        <template v-if="showHistory">
          <div
            v-if="history.length === 0"
            class="rounded-xl border border-dashed border-border p-8 text-center"
          >
            <p class="text-sm text-muted-foreground">
              No alerts fired yet.
            </p>
          </div>
          <div
            v-else
            class="rounded-xl border border-border overflow-hidden"
          >
            <table class="w-full text-sm">
              <thead class="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th class="text-left px-4 py-2.5 font-medium">
                    Time
                  </th>
                  <th class="text-left px-4 py-2.5 font-medium">
                    Detail
                  </th>
                  <th class="text-left px-4 py-2.5 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="entry in history"
                  :key="entry.id"
                  class="border-t border-border hover:bg-muted/20 transition-colors"
                >
                  <td class="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {{ timeAgo(entry.triggeredAt) }}
                  </td>
                  <td
                    class="px-4 py-2.5 text-xs max-w-xs truncate"
                    :title="entry.detail"
                  >
                    {{ entry.detail.replace(/\*\*/g, '') }}
                  </td>
                  <td class="px-4 py-2.5">
                    <span
                      :class="['inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase',
                               entry.status === 'sent' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      ]"
                    >
                      <CheckCircle
                        v-if="entry.status === 'sent'"
                        class="size-2.5"
                      />
                      <XCircle
                        v-else
                        class="size-2.5"
                      />
                      {{ entry.status }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>
    </template>

    <Teleport to="body">
      <div
        v-if="showDestModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      >
        <div class="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-5">
          <h2 class="text-base font-semibold">
            {{ editingDest ? 'Edit destination' : 'Add destination' }}
          </h2>

          <!-- Type selector -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-muted-foreground">Type</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="(meta, key) in DEST_META"
                :key="key"
                :class="['px-3 py-2 rounded-lg border text-xs font-semibold transition-colors',
                         destForm.type === key
                           ? `border-transparent ${meta.bg} ${meta.color}`
                           : 'border-border text-muted-foreground hover:bg-accent']"
                @click="destForm.type = key as AlertDestinationType"
              >
                {{ meta.label }}
              </button>
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-muted-foreground">Name</label>
            <input
              v-model="destForm.name"
              type="text"
              placeholder="e.g. Production Discord"
              class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-muted-foreground">
              {{ destForm.type === 'ntfy' ? 'ntfy Base URL' : 'Webhook URL' }}
            </label>
            <input
              v-model="destForm.webhookUrl"
              type="text"
              :placeholder="destForm.type === 'discord' ? 'https://discord.com/api/webhooks/...'
                : destForm.type === 'slack' ? 'https://hooks.slack.com/services/...'
                  : 'https://ntfy.sh'"
              class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
          </div>

          <!-- ntfy-specific -->
          <template v-if="destForm.type === 'ntfy'">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">Topic</label>
              <input
                v-model="destForm.ntfyTopic"
                type="text"
                placeholder="my-alerts"
                class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">Priority</label>
              <select
                v-model="destForm.ntfyPriority"
                class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="min">
                  Min
                </option>
                <option value="low">
                  Low
                </option>
                <option value="default">
                  Default
                </option>
                <option value="high">
                  High
                </option>
                <option value="urgent">
                  Urgent
                </option>
              </select>
            </div>
          </template>

          <p
            v-if="destError"
            class="text-xs text-red-400"
          >
            {{ destError }}
          </p>

          <div class="flex items-center gap-2 pt-1">
            <button
              class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              :disabled="destSaving"
              @click="saveDest"
            >
              {{ destSaving ? 'Saving…' : 'Save' }}
            </button>
            <button
              class="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
              @click="showDestModal = false"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showRuleModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      >
        <div class="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
          <h2 class="text-base font-semibold">
            {{ editingRule ? 'Edit rule' : 'Add rule' }}
          </h2>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-muted-foreground">Name</label>
            <input
              v-model="ruleForm.name"
              type="text"
              placeholder="e.g. API Down"
              class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
          </div>

          <!-- Type -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-muted-foreground">Alert Type</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="type in (['health_check', 'container_event'] as AlertRuleType[])"
                :key="type"
                :class="['px-3 py-2 rounded-lg border text-xs font-medium transition-colors text-left',
                         ruleForm.type === type
                           ? 'border-primary bg-primary/10 text-primary'
                           : 'border-border text-muted-foreground hover:bg-accent']"
                @click="ruleForm.type = type"
              >
                {{ type === 'health_check' ? 'Health Check' : 'Container Event' }}
              </button>
            </div>
          </div>

          <!-- Health check config -->
          <template v-if="ruleForm.type === 'health_check'">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">Health Check <span class="text-muted-foreground/50">(leave blank for all)</span></label>
              <select
                v-model="ruleForm.healthCheckId"
                class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">
                  All health checks
                </option>
                <option
                  v-for="hc in healthChecks"
                  :key="hc.id"
                  :value="hc.id"
                >
                  {{ hc.name }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">Trigger On</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="s in (['down', 'up', 'both'] as HealthCheckTrigger[])"
                  :key="s"
                  :class="['px-3 py-2 rounded-lg border text-xs font-medium transition-colors capitalize',
                           ruleForm.onStatus === s
                             ? 'border-primary bg-primary/10 text-primary'
                             : 'border-border text-muted-foreground hover:bg-accent']"
                  @click="ruleForm.onStatus = s"
                >
                  {{ s }}
                </button>
              </div>
            </div>
          </template>

          <!-- Container event config -->
          <template v-else>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">Agent <span class="text-muted-foreground/50">(leave blank for all)</span></label>
              <select
                v-model="ruleForm.agentId"
                class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">
                  All agents
                </option>
                <option
                  v-for="agent in agents"
                  :key="agent.id"
                  :value="agent.id"
                >
                  {{ agent.hostname }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">Events</label>
              <div class="flex gap-2">
                <button
                  v-for="ev in (['crash', 'restart'] as ContainerEventType[])"
                  :key="ev"
                  :class="['px-3 py-2 rounded-lg border text-xs font-medium transition-colors capitalize',
                           ruleForm.events.includes(ev)
                             ? 'border-primary bg-primary/10 text-primary'
                             : 'border-border text-muted-foreground hover:bg-accent']"
                  @click="toggleEvent(ev)"
                >
                  {{ ev === 'crash' ? '💥 Crash' : '🔄 Restart' }}
                </button>
              </div>
            </div>
          </template>

          <!-- Destination -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-muted-foreground">Destination</label>
            <select
              v-model="ruleForm.destinationId"
              class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">
                Select a destination
              </option>
              <option
                v-for="d in destinations"
                :key="d.id"
                :value="d.id"
              >
                {{ d.name }} ({{ DEST_META[d.type].label }})
              </option>
            </select>
          </div>

          <!-- Cooldown -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-muted-foreground">
              Cooldown — {{ formatCooldown(ruleForm.cooldown) }}
            </label>
            <input
              v-model.number="ruleForm.cooldown"
              type="range"
              min="30"
              max="3600"
              step="30"
              class="w-full accent-primary"
            >
            <div class="flex justify-between text-[10px] text-muted-foreground/60">
              <span>30s</span><span>15m</span><span>30m</span><span>1h</span>
            </div>
          </div>

          <p
            v-if="ruleError"
            class="text-xs text-red-400"
          >
            {{ ruleError }}
          </p>

          <div class="flex items-center gap-2 pt-1">
            <button
              class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              :disabled="ruleSaving"
              @click="saveRule"
            >
              {{ ruleSaving ? 'Saving…' : 'Save' }}
            </button>
            <button
              class="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
              @click="showRuleModal = false"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>