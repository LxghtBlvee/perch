<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { Eye, EyeOff, KeyRound } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const showToken = ref(false)

const auth = useAuthStore()

interface InstanceSettings {
  sessionDays: number
  selfRegistrationEnabled: boolean
  defaultUserRole: 'member' | 'admin'
  loginLockoutEnabled: boolean
  loginLockoutThreshold: number
  agentReportInterval: number
  agentReconnectDelay: number
  defaultHealthCheckInterval: number
  defaultHealthCheckTimeout: number
  alertWebhookTimeout: number
  defaultAlertCooldown: number
  geolocationEnabled: boolean
  metricsRetentionDays: number
  alertHistoryRetentionDays: number
  healthCheckResultsRetentionDays: number
  maintenanceModeEnabled: boolean
  statusPageEnabled: boolean
}

const defaults: InstanceSettings = {
  sessionDays: 30,
  selfRegistrationEnabled: false,
  defaultUserRole: 'member',
  loginLockoutEnabled: true,
  loginLockoutThreshold: 5,
  agentReportInterval: 5000,
  agentReconnectDelay: 5000,
  defaultHealthCheckInterval: 60,
  defaultHealthCheckTimeout: 10000,
  alertWebhookTimeout: 10000,
  defaultAlertCooldown: 300,
  geolocationEnabled: true,
  metricsRetentionDays: 30,
  alertHistoryRetentionDays: 90,
  healthCheckResultsRetentionDays: 90,
  maintenanceModeEnabled: false,
  statusPageEnabled: false,
}

const saved = ref<InstanceSettings>({ ...defaults })
const local = ref<InstanceSettings>({ ...defaults })
const loading = ref(true)
const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)
const version = ref<string | null>(null)

const hasChanges = computed(() => JSON.stringify(saved.value) !== JSON.stringify(local.value))

onMounted(async () => {
  const [settingsRes, versionRes] = await Promise.all([
    fetch('/api/admin/instance-settings', { headers: { Authorization: `Bearer ${auth.token}` } }),
    fetch('/api/admin/instance-settings/version', { headers: { Authorization: `Bearer ${auth.token}` } }),
  ])
  if (settingsRes.ok) {
    const data = await settingsRes.json() as InstanceSettings
    saved.value = { ...defaults, ...data }
    local.value = { ...defaults, ...data }
  }
  if (versionRes.ok) {
    const data = await versionRes.json() as { version: string }
    version.value = data.version
  }
  loading.value = false
})

async function saveAll() {
  saving.value = true
  saveError.value = ''
  saveSuccess.value = false
  try {
    const res = await fetch('/api/admin/instance-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(local.value),
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      saveError.value = data.error ?? 'Save failed'
    } else {
      const data = await res.json() as InstanceSettings
      saved.value = { ...defaults, ...data }
      local.value = { ...defaults, ...data }
      saveSuccess.value = true
      setTimeout(() => { saveSuccess.value = false }, 2500)
    }
  } finally {
    saving.value = false
  }
}

function discardChanges() {
  local.value = { ...saved.value }
}

const CARD = 'rounded-xl border border-border bg-card p-5 flex flex-col gap-3'
const INPUT = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50'
</script>

<template>
  <div class="p-6 space-y-8 max-w-5xl pb-24">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">
        Instance
      </h1>
      <p class="text-sm text-muted-foreground mt-1">
        Configure your Perch instance.
      </p>
    </div>

    <!-- General -->
    <section>
      <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        General
      </h2>
      <div class="grid grid-cols-3 gap-4">
        <div class="col-span-2 rounded-xl border border-border bg-card p-5 space-y-3">
          <div>
            <h3 class="text-sm font-medium">
              Hub token
            </h3>
            <p class="text-xs text-muted-foreground mt-0.5">
              Shared secret for agent auth. Set via <code class="bg-muted px-1 py-0.5 rounded">PERCH_HUB_TOKEN</code>.
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
            {{ version ?? '...' }}
          </p>
        </div>
        <div class="col-span-3">
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
        </div>
      </div>
    </section>

    <div
      v-if="loading"
      class="text-sm text-muted-foreground"
    >
      Loading...
    </div>

    <template v-else>
      <!-- Sessions & Security -->
      <section>
        <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Sessions & Security
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <!-- Session expiry -->
          <div :class="CARD">
            <div>
              <p class="text-sm font-medium">
                Session expiry
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                How long login sessions last.
              </p>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <input
                v-model.number="local.sessionDays"
                type="number"
                min="1"
                :class="INPUT"
              >
              <span class="text-xs text-muted-foreground shrink-0">days</span>
            </div>
          </div>

          <!-- Self-registration -->
          <div :class="CARD">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-sm font-medium">
                  Self-registration
                </p>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Allow anyone to create an account.
                </p>
              </div>
              <button
                class="relative shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5"
                :class="local.selfRegistrationEnabled ? 'bg-primary' : 'bg-muted'"
                @click="local.selfRegistrationEnabled = !local.selfRegistrationEnabled"
              >
                <div :class="['absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform', local.selfRegistrationEnabled ? 'translate-x-4' : 'translate-x-0.5']" />
              </button>
            </div>
            <div
              v-if="local.selfRegistrationEnabled"
              class="mt-auto"
            >
              <label class="text-xs text-muted-foreground mb-1 block">Default role</label>
              <select
                v-model="local.defaultUserRole"
                :class="INPUT"
              >
                <option value="member">
                  Member
                </option>
                <option value="admin">
                  Admin
                </option>
              </select>
            </div>
          </div>

          <!-- Login lockout -->
          <div :class="CARD">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-sm font-medium">
                  Login lockout
                </p>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Lock account after failed attempts.
                </p>
              </div>
              <button
                class="relative shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5"
                :class="local.loginLockoutEnabled ? 'bg-primary' : 'bg-muted'"
                @click="local.loginLockoutEnabled = !local.loginLockoutEnabled"
              >
                <div :class="['absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform', local.loginLockoutEnabled ? 'translate-x-4' : 'translate-x-0.5']" />
              </button>
            </div>
            <div
              v-if="local.loginLockoutEnabled"
              class="mt-auto"
            >
              <label class="text-xs text-muted-foreground mb-1 block">Threshold</label>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="local.loginLockoutThreshold"
                  type="number"
                  min="1"
                  :class="INPUT"
                >
                <span class="text-xs text-muted-foreground shrink-0">attempts</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Agents & Monitoring -->
      <section>
        <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Agents & Monitoring
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div :class="CARD">
            <div>
              <p class="text-sm font-medium">
                Report interval
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                How often agents push metrics.
              </p>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <input
                v-model.number="local.agentReportInterval"
                type="number"
                min="1000"
                step="1000"
                :class="INPUT"
              >
              <span class="text-xs text-muted-foreground shrink-0">ms</span>
            </div>
          </div>
          <div :class="CARD">
            <div>
              <p class="text-sm font-medium">
                Reconnect delay
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                Agent WS reconnect backoff.
              </p>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <input
                v-model.number="local.agentReconnectDelay"
                type="number"
                min="1000"
                step="1000"
                :class="INPUT"
              >
              <span class="text-xs text-muted-foreground shrink-0">ms</span>
            </div>
          </div>
          <div :class="CARD">
            <div>
              <p class="text-sm font-medium">
                Check interval
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                Default health check cadence.
              </p>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <input
                v-model.number="local.defaultHealthCheckInterval"
                type="number"
                min="10"
                :class="INPUT"
              >
              <span class="text-xs text-muted-foreground shrink-0">s</span>
            </div>
          </div>
          <div :class="CARD">
            <div>
              <p class="text-sm font-medium">
                Check timeout
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                Per-request HTTP timeout.
              </p>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <input
                v-model.number="local.defaultHealthCheckTimeout"
                type="number"
                min="1000"
                step="1000"
                :class="INPUT"
              >
              <span class="text-xs text-muted-foreground shrink-0">ms</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Alerts -->
      <section>
        <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Alerts
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div :class="CARD">
            <div>
              <p class="text-sm font-medium">
                Webhook timeout
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                Timeout for alert webhook sends.
              </p>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <input
                v-model.number="local.alertWebhookTimeout"
                type="number"
                min="1000"
                step="1000"
                :class="INPUT"
              >
              <span class="text-xs text-muted-foreground shrink-0">ms</span>
            </div>
          </div>
          <div :class="CARD">
            <div>
              <p class="text-sm font-medium">
                Default cooldown
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                Default cooldown for new alert rules.
              </p>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <input
                v-model.number="local.defaultAlertCooldown"
                type="number"
                min="0"
                :class="INPUT"
              >
              <span class="text-xs text-muted-foreground shrink-0">s</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Privacy -->
      <section>
        <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Privacy
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div :class="CARD">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-sm font-medium">
                  Geolocation
                </p>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Fetch hub location from <code class="bg-muted px-1 rounded">ipapi.co</code> on startup.
                </p>
              </div>
              <button
                class="relative shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5"
                :class="local.geolocationEnabled ? 'bg-primary' : 'bg-muted'"
                @click="local.geolocationEnabled = !local.geolocationEnabled"
              >
                <div :class="['absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform', local.geolocationEnabled ? 'translate-x-4' : 'translate-x-0.5']" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Retention -->
      <section>
        <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Retention
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div :class="CARD">
            <div>
              <p class="text-sm font-medium">
                Metrics history
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                How long to keep agent metrics.
              </p>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <input
                v-model.number="local.metricsRetentionDays"
                type="number"
                min="1"
                :class="INPUT"
              >
              <span class="text-xs text-muted-foreground shrink-0">days</span>
            </div>
          </div>
          <div :class="CARD">
            <div>
              <p class="text-sm font-medium">
                Alert history
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                How long to keep fired alert records.
              </p>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <input
                v-model.number="local.alertHistoryRetentionDays"
                type="number"
                min="1"
                :class="INPUT"
              >
              <span class="text-xs text-muted-foreground shrink-0">days</span>
            </div>
          </div>
          <div :class="CARD">
            <div>
              <p class="text-sm font-medium">
                Health check results
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                How long to keep ping results.
              </p>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <input
                v-model.number="local.healthCheckResultsRetentionDays"
                type="number"
                min="1"
                :class="INPUT"
              >
              <span class="text-xs text-muted-foreground shrink-0">days</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Maintenance -->
      <section>
        <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Maintenance
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div :class="CARD">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-sm font-medium">
                  Maintenance mode
                </p>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Block non-admin logins during upgrades.
                </p>
              </div>
              <button
                class="relative shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5"
                :class="local.maintenanceModeEnabled ? 'bg-amber-500' : 'bg-muted'"
                @click="local.maintenanceModeEnabled = !local.maintenanceModeEnabled"
              >
                <div :class="['absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform', local.maintenanceModeEnabled ? 'translate-x-4' : 'translate-x-0.5']" />
              </button>
            </div>
            <p
              v-if="local.maintenanceModeEnabled"
              class="text-xs text-amber-500 font-medium"
            >
              Only admins can sign in while this is on.
            </p>
          </div>
        </div>
      </section>

      <!-- Status Pages -->
      <section>
        <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Status Pages
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div :class="CARD">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-sm font-medium">
                  Enable status pages
                </p>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Publish public-facing status pages at <code class="bg-muted px-1 rounded">/status/:slug</code>.
                </p>
              </div>
              <button
                class="relative shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5"
                :class="local.statusPageEnabled ? 'bg-primary' : 'bg-muted'"
                @click="local.statusPageEnabled = !local.statusPageEnabled"
              >
                <div :class="['absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform', local.statusPageEnabled ? 'translate-x-4' : 'translate-x-0.5']" />
              </button>
            </div>
            <RouterLink
              v-if="local.statusPageEnabled"
              to="/admin/status-pages"
              class="text-xs text-primary hover:underline mt-auto"
            >
              Manage status pages →
            </RouterLink>
          </div>
        </div>
      </section>
    </template>

    <!-- Sticky save bar -->
    <Transition
      enter-active-class="transition-all duration-200"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition-all duration-200"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="hasChanges || saveSuccess"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-card border border-border rounded-xl shadow-lg px-5 py-3 z-50"
      >
        <p
          v-if="saveError"
          class="text-xs text-red-500"
        >
          {{ saveError }}
        </p>
        <p
          v-else-if="saveSuccess"
          class="text-xs text-green-500 font-medium"
        >
          Changes saved!
        </p>
        <p
          v-else
          class="text-xs text-muted-foreground"
        >
          You have unsaved changes.
        </p>
        <div class="flex items-center gap-2">
          <button
            v-if="hasChanges"
            class="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
            @click="discardChanges"
          >
            Discard
          </button>
          <button
            v-if="hasChanges"
            :disabled="saving"
            class="px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            @click="saveAll"
          >
            {{ saving ? 'Saving...' : 'Save changes' }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>