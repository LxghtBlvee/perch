<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
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

// --- OAuth settings (admin only) ---
interface ProviderConfig {
  provider: 'github' | 'google' | 'custom'
  enabled: boolean
  clientId: string
  clientSecret: string
  hasClientSecret: boolean
  customName: string
  customAuthorizationUrl: string
  customTokenUrl: string
  customUserinfoUrl: string
  customScopes: string
  allowedOrg: string
  allowedDomain: string
  saving: boolean
  saveError: string
  saved: boolean
}

const providers = ref<ProviderConfig[]>([])

onMounted(async () => {
  if (!auth.isAdmin) return
  const res = await fetch('/api/settings/oauth', {
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  if (res.ok) {
    const data = await res.json() as Omit<ProviderConfig, 'clientSecret' | 'saving' | 'saveError' | 'saved'>[]
    providers.value = data.map(p => ({
      ...p,
      clientId: p.clientId ?? '',
      clientSecret: '',
      customName: p.customName ?? '',
      customAuthorizationUrl: p.customAuthorizationUrl ?? '',
      customTokenUrl: p.customTokenUrl ?? '',
      customUserinfoUrl: p.customUserinfoUrl ?? '',
      customScopes: p.customScopes ?? '',
      allowedOrg: p.allowedOrg ?? '',
      allowedDomain: p.allowedDomain ?? '',
      saving: false,
      saveError: '',
      saved: false,
    }))
  }
})

function providerLabel(p: ProviderConfig) {
  if (p.provider === 'custom') return p.customName || 'Custom SSO'
  return p.provider === 'github' ? 'GitHub' : 'Google'
}

function providerDesc(p: ProviderConfig) {
  if (p.provider === 'github') return 'Sign in with GitHub OAuth'
  if (p.provider === 'google') return 'Sign in with Google OAuth'
  return 'Authentik, Keycloak, or any OIDC provider'
}

async function saveProvider(p: ProviderConfig) {
  p.saveError = ''
  // Validate before saving
  if (p.enabled) {
    if (!p.clientId) { p.saveError = 'Client ID is required to enable this provider'; return }
    if (!p.hasClientSecret && !p.clientSecret) { p.saveError = 'Client Secret is required to enable this provider'; return }
  }
  p.saving = true
  p.saved = false
  try {
    const res = await fetch(`/api/settings/oauth/${p.provider}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({
        enabled: p.enabled,
        clientId: p.clientId || undefined,
        clientSecret: p.clientSecret || undefined,
        customName: p.customName || undefined,
        customAuthorizationUrl: p.customAuthorizationUrl || undefined,
        customTokenUrl: p.customTokenUrl || undefined,
        customUserinfoUrl: p.customUserinfoUrl || undefined,
        customScopes: p.customScopes || undefined,
        allowedOrg: p.allowedOrg || undefined,
        allowedDomain: p.allowedDomain || undefined,
      }),
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      p.saveError = data.error ?? 'Save failed'
    } else {
      p.clientSecret = ''
      p.hasClientSecret = !!p.clientId
      p.saved = true
      setTimeout(() => { p.saved = false }, 2000)
    }
  } finally {
    p.saving = false
  }
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50'
</script>

<template>
  <div class="p-6 space-y-8 max-w-5xl">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
      <p class="text-sm text-muted-foreground mt-1">Manage your Perch instance.</p>
    </div>

    <!-- General — 3-col grid -->
    <section>
      <h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">General</h2>
      <div class="grid grid-cols-3 gap-4">

        <!-- Hub token -->
        <div class="col-span-2 rounded-xl border border-border bg-card p-5 space-y-3">
          <div>
            <h3 class="text-sm font-medium">Hub token</h3>
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
              <Eye v-if="!showToken" class="size-4 text-muted-foreground" :stroke-width="1.75" />
              <EyeOff v-else class="size-4 text-muted-foreground" :stroke-width="1.75" />
            </button>
          </div>
        </div>

        <!-- Version -->
        <div class="rounded-xl border border-border bg-card p-5 flex flex-col justify-between">
          <div>
            <h3 class="text-sm font-medium">Version</h3>
            <p class="text-xs text-muted-foreground mt-0.5">Current release</p>
          </div>
          <p class="text-2xl font-mono font-semibold text-primary mt-4">v0.0.1</p>
        </div>

        <!-- Color mode — full width -->
        <div class="col-span-3 rounded-xl border border-border bg-card p-5">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-medium">Color mode</h3>
              <p class="text-xs text-muted-foreground mt-0.5">Choose light, dark, or follow your OS.</p>
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

    <!-- OAuth / SSO — admin only -->
    <template v-if="auth.isAdmin">
      <section>
        <h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Authentication</h2>
        <div class="grid grid-cols-3 gap-4">
          <div
            v-for="p in providers"
            :key="p.provider"
            class="rounded-xl border border-border bg-card p-5 space-y-4 flex flex-col"
          >
            <!-- Header -->
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-sm font-medium">{{ providerLabel(p) }}</p>
                <p class="text-xs text-muted-foreground mt-0.5">{{ providerDesc(p) }}</p>
              </div>
              <button
                class="relative shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5"
                :class="p.enabled ? 'bg-primary' : 'bg-muted'"
                @click="p.enabled = !p.enabled"
              >
                <div :class="['absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform', p.enabled ? 'translate-x-4' : 'translate-x-0.5']" />
              </button>
            </div>

            <!-- Fields -->
            <div class="space-y-2 flex-1">
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">Client ID</label>
                <input v-model="p.clientId" type="text" placeholder="Client ID" :class="INPUT" />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">Client Secret{{ p.hasClientSecret ? ' (stored)' : '' }}</label>
                <input v-model="p.clientSecret" type="password" :placeholder="p.hasClientSecret ? 'Leave blank to keep' : 'Client Secret'" :class="INPUT" />
              </div>
              <!-- Org/domain restriction -->
              <div v-if="p.provider === 'github'" class="space-y-1">
                <label class="text-xs text-muted-foreground">Allowed org <span class="text-muted-foreground/50">(optional)</span></label>
                <input v-model="p.allowedOrg" type="text" placeholder="my-org" :class="INPUT" />
                <p class="text-xs text-muted-foreground/60">Only members of this GitHub org can sign in.</p>
              </div>
              <div v-if="p.provider === 'google' || p.provider === 'custom'" class="space-y-1">
                <label class="text-xs text-muted-foreground">Allowed domain <span class="text-muted-foreground/50">(optional)</span></label>
                <input v-model="p.allowedDomain" type="text" placeholder="mycompany.com" :class="INPUT" />
                <p class="text-xs text-muted-foreground/60">Only emails from this domain can sign in.</p>
              </div>

              <template v-if="p.provider === 'custom'">
                <div class="space-y-1">
                  <label class="text-xs text-muted-foreground">Display name</label>
                  <input v-model="p.customName" type="text" placeholder="Authentik" :class="INPUT" />
                </div>
                <div class="space-y-1">
                  <label class="text-xs text-muted-foreground">Authorization URL</label>
                  <input v-model="p.customAuthorizationUrl" type="url" placeholder="https://…/authorize/" :class="INPUT" />
                </div>
                <div class="space-y-1">
                  <label class="text-xs text-muted-foreground">Token URL</label>
                  <input v-model="p.customTokenUrl" type="url" placeholder="https://…/token/" :class="INPUT" />
                </div>
                <div class="space-y-1">
                  <label class="text-xs text-muted-foreground">Userinfo URL</label>
                  <input v-model="p.customUserinfoUrl" type="url" placeholder="https://…/userinfo/" :class="INPUT" />
                </div>
                <div class="space-y-1">
                  <label class="text-xs text-muted-foreground">Scopes</label>
                  <input v-model="p.customScopes" type="text" placeholder="openid email profile" :class="INPUT" />
                </div>
              </template>
            </div>

            <!-- Save -->
            <div>
              <p v-if="p.saveError" class="text-xs text-red-500 mb-2">{{ p.saveError }}</p>
              <button
                :disabled="p.saving"
                class="w-full py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                :class="p.saved ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary hover:bg-primary/20'"
                @click="saveProvider(p)"
              >
                {{ p.saving ? 'Saving...' : p.saved ? 'Saved!' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
