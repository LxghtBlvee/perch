<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const showToken = ref(false)

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
}

const providers = ref<ProviderConfig[]>([])
const expandedProvider = ref<string | null>(null)
const saving = ref<string | null>(null)
const saveError = ref<string | null>(null)

onMounted(async () => {
  if (!auth.isAdmin) return
  const res = await fetch('/api/settings/oauth', {
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  if (res.ok) {
    const data = await res.json() as ProviderConfig[]
    providers.value = data.map(p => ({
      ...p,
      clientId: p.clientId ?? '',
      clientSecret: '',
      customName: p.customName ?? '',
      customAuthorizationUrl: p.customAuthorizationUrl ?? '',
      customTokenUrl: p.customTokenUrl ?? '',
      customUserinfoUrl: p.customUserinfoUrl ?? '',
      customScopes: p.customScopes ?? '',
    }))
  }
})

function toggleProvider(provider: string) {
  expandedProvider.value = expandedProvider.value === provider ? null : provider
}

function providerLabel(p: ProviderConfig) {
  if (p.provider === 'custom') return 'Custom (Authentik, etc.)'
  return p.provider === 'github' ? 'GitHub' : 'Google'
}

async function saveProvider(p: ProviderConfig) {
  saving.value = p.provider
  saveError.value = null
  try {
    const res = await fetch(`/api/settings/oauth/${p.provider}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({
        enabled: p.enabled,
        clientId: p.clientId || undefined,
        clientSecret: p.clientSecret || undefined,
        customName: p.customName || undefined,
        customAuthorizationUrl: p.customAuthorizationUrl || undefined,
        customTokenUrl: p.customTokenUrl || undefined,
        customUserinfoUrl: p.customUserinfoUrl || undefined,
        customScopes: p.customScopes || undefined,
      }),
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      saveError.value = data.error ?? 'Save failed'
    } else {
      p.clientSecret = ''
      p.hasClientSecret = !!p.clientId
    }
  } finally {
    saving.value = null
  }
}
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

    <!-- OAuth / SSO — admin only -->
    <template v-if="auth.isAdmin">
      <div>
        <h2 class="text-lg font-semibold tracking-tight">
          Authentication
        </h2>
        <p class="text-sm text-muted-foreground mt-1">
          Configure OAuth providers for your org.
        </p>
      </div>

      <div class="rounded-xl border border-border bg-card divide-y divide-border">
        <div
          v-for="p in providers"
          :key="p.provider"
        >
          <!-- Provider header row -->
          <button
            class="w-full flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors text-left"
            @click="toggleProvider(p.provider)"
          >
            <div class="flex-1">
              <p class="text-sm font-medium">
                {{ providerLabel(p) }}
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ p.enabled ? 'Enabled' : 'Disabled' }}
                <template v-if="p.enabled && !p.clientId">
                  · Missing client ID
                </template>
              </p>
            </div>
            <div :class="['size-2 rounded-full shrink-0', p.enabled ? 'bg-green-500' : 'bg-muted-foreground/30']" />
            <ChevronDown
              v-if="expandedProvider !== p.provider"
              class="size-4 text-muted-foreground shrink-0"
              :stroke-width="1.75"
            />
            <ChevronUp
              v-else
              class="size-4 text-muted-foreground shrink-0"
              :stroke-width="1.75"
            />
          </button>

          <!-- Expanded config -->
          <div
            v-if="expandedProvider === p.provider"
            class="px-4 pb-4 space-y-3"
          >
            <!-- Enable toggle -->
            <label class="flex items-center gap-3 cursor-pointer">
              <div
                class="relative w-8 h-4 rounded-full transition-colors"
                :class="p.enabled ? 'bg-primary' : 'bg-muted'"
                @click="p.enabled = !p.enabled"
              >
                <div :class="['absolute top-0.5 size-3 rounded-full bg-white shadow transition-transform', p.enabled ? 'translate-x-4' : 'translate-x-0.5']" />
              </div>
              <span class="text-sm">{{ p.enabled ? 'Enabled' : 'Disabled' }}</span>
            </label>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">Client ID</label>
                <input
                  v-model="p.clientId"
                  type="text"
                  placeholder="Client ID"
                  class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">
                  Client Secret {{ p.hasClientSecret ? '(stored — leave blank to keep)' : '' }}
                </label>
                <input
                  v-model="p.clientSecret"
                  type="password"
                  :placeholder="p.hasClientSecret ? '••••••••' : 'Client Secret'"
                  class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
              </div>
            </div>

            <!-- Custom provider extra fields -->
            <template v-if="p.provider === 'custom'">
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">Display name (e.g. "Authentik")</label>
                <input
                  v-model="p.customName"
                  type="text"
                  placeholder="My SSO"
                  class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">Authorization URL</label>
                <input
                  v-model="p.customAuthorizationUrl"
                  type="url"
                  placeholder="https://auth.example.com/application/o/authorize/"
                  class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">Token URL</label>
                <input
                  v-model="p.customTokenUrl"
                  type="url"
                  placeholder="https://auth.example.com/application/o/token/"
                  class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">Userinfo URL</label>
                <input
                  v-model="p.customUserinfoUrl"
                  type="url"
                  placeholder="https://auth.example.com/application/o/userinfo/"
                  class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">Scopes (space-separated)</label>
                <input
                  v-model="p.customScopes"
                  type="text"
                  placeholder="openid email profile"
                  class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
              </div>
            </template>

            <p
              v-if="saveError"
              class="text-xs text-red-500"
            >
              {{ saveError }}
            </p>

            <button
              :disabled="saving === p.provider"
              class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              @click="saveProvider(p)"
            >
              {{ saving === p.provider ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
