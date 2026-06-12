<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { X, ExternalLink } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

interface ProviderConfig {
  provider: 'github' | 'google' | 'microsoft' | 'gitlab' | 'discord' | 'okta' | 'custom'
  enabled: boolean
  clientId: string
  clientSecret: string
  hasClientSecret: boolean
  customName: string
  customAuthorizationUrl: string
  customTokenUrl: string
  customUserinfoUrl: string
  customScopes: string
  providerTenantId: string
  providerBaseUrl: string
  allowedOrg: string
  allowedDomain: string
  saving: boolean
  saveError: string
  saved: boolean
}

const PROVIDER_META: Record<ProviderConfig['provider'], {
  label: string
  desc: string
  icon: string
  docsUrl: string
  bg: string
  iconSize: string
}> = {
  github: {
    label: 'GitHub',
    desc: 'Let users sign in with their GitHub account.',
    icon: '/icons/github.svg',
    docsUrl: 'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app',
    bg: 'bg-[#161b22]',
    iconSize: 'size-5',
  },
  google: {
    label: 'Google',
    desc: 'Sign in with Google via OAuth 2.0.',
    icon: '/icons/google.svg',
    docsUrl: 'https://developers.google.com/identity/protocols/oauth2',
    bg: 'bg-white',
    iconSize: 'size-5',
  },
  microsoft: {
    label: 'Microsoft',
    desc: 'Azure AD / Entra ID for organizations.',
    icon: '/icons/microsoft.svg',
    docsUrl: 'https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app',
    bg: 'bg-[#f3f3f3]',
    iconSize: 'size-5',
  },
  gitlab: {
    label: 'GitLab',
    desc: 'Sign in with GitLab — cloud or self-hosted.',
    icon: '/icons/gitlab.svg',
    docsUrl: 'https://docs.gitlab.com/ee/integration/oauth_provider.html',
    bg: 'bg-[#1a1a2e]',
    iconSize: 'size-5',
  },
  discord: {
    label: 'Discord',
    desc: 'Sign in with a Discord account.',
    icon: '/icons/discord.svg',
    docsUrl: 'https://discord.com/developers/docs/topics/oauth2',
    bg: 'bg-[#5865f2]',
    iconSize: 'size-5',
  },
  okta: {
    label: 'Okta',
    desc: 'Enterprise SSO via Okta.',
    icon: '/icons/okta.svg',
    docsUrl: 'https://developer.okta.com/docs/guides/implement-oauth-for-okta/main/',
    bg: 'bg-[#00297a]',
    iconSize: 'size-5',
  },
  custom: {
    label: 'Custom SSO',
    desc: 'Any OIDC provider — Authentik, Keycloak, and more.',
    icon: '',
    docsUrl: 'https://openid.net/developers/how-connect-works/',
    bg: 'bg-primary/20',
    iconSize: 'size-5',
  },
}

const providers = ref<ProviderConfig[]>([])
const loading = ref(true)
const active = ref<ProviderConfig | null>(null)

onMounted(async () => {
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
      providerTenantId: p.providerTenantId ?? '',
      providerBaseUrl: p.providerBaseUrl ?? '',
      allowedOrg: p.allowedOrg ?? '',
      allowedDomain: p.allowedDomain ?? '',
      saving: false,
      saveError: '',
      saved: false,
    }))
  }
  loading.value = false
})

function openProvider(p: ProviderConfig) {
  active.value = p
}

function closePanel() {
  active.value = null
}

async function saveProvider() {
  if (!active.value) return
  const p = active.value
  p.saveError = ''
  if (p.enabled) {
    if (!p.clientId) { p.saveError = 'Client ID is required'; return }
    if (!p.hasClientSecret && !p.clientSecret) { p.saveError = 'Client Secret is required'; return }
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
        providerTenantId: p.providerTenantId || undefined,
        providerBaseUrl: p.providerBaseUrl || undefined,
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
      setTimeout(() => { if (p.saved) p.saved = false }, 2000)
    }
  } finally {
    p.saving = false
  }
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50'
</script>

<template>
  <div class="p-6 space-y-6 max-w-5xl">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">
        Authentication
      </h1>
      <p class="text-sm text-muted-foreground mt-1">
        Configure sign-in methods for your Perch instance.
      </p>
    </div>

    <div
      v-if="loading"
      class="text-sm text-muted-foreground"
    >
      Loading...
    </div>

    <!-- Provider cards grid -->
    <div
      v-else
      class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
    >
      <button
        v-for="p in providers"
        :key="p.provider"
        class="group relative flex flex-col items-start gap-3 rounded-xl border bg-card p-4 text-left hover:bg-accent transition-colors"
        :class="p.enabled ? 'border-primary/40' : 'border-border'"
        @click="openProvider(p)"
      >
        <!-- Enabled dot -->
        <div
          v-if="p.enabled"
          class="absolute top-3 right-3 size-2 rounded-full bg-green-500"
          title="Enabled"
        />

        <!-- Icon -->
        <div
          class="size-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
          :class="PROVIDER_META[p.provider].bg"
        >
          <img
            v-if="PROVIDER_META[p.provider].icon"
            :src="PROVIDER_META[p.provider].icon"
            :alt="PROVIDER_META[p.provider].label"
            :class="PROVIDER_META[p.provider].iconSize"
            class="object-contain"
          >
          <span
            v-else
            class="text-[10px] font-bold text-white"
          >SSO</span>
        </div>

        <!-- Text -->
        <div class="min-w-0">
          <p class="text-sm font-semibold leading-tight">
            {{ p.provider === 'custom' && p.customName ? p.customName : PROVIDER_META[p.provider].label }}
          </p>
          <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
            {{ PROVIDER_META[p.provider].desc }}
          </p>
        </div>

        <!-- Docs link -->
        <a
          :href="PROVIDER_META[p.provider].docsUrl"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-auto"
          @click.stop
        >
          <ExternalLink
            class="size-3"
            :stroke-width="1.75"
          />
          Docs
        </a>
      </button>
    </div>

    <!-- Config panel overlay -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="active"
          class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
          @click.self="closePanel"
        >
          <Transition
            enter-active-class="transition-all duration-200"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition-all duration-150"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="active"
              class="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            >
              <!-- Header -->
              <div class="flex items-center gap-3 p-5 border-b border-border">
                <div
                  class="size-9 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
                  :class="PROVIDER_META[active.provider].bg"
                >
                  <img
                    v-if="PROVIDER_META[active.provider].icon"
                    :src="PROVIDER_META[active.provider].icon"
                    :alt="PROVIDER_META[active.provider].label"
                    class="size-5 object-contain"
                  >
                  <span
                    v-else
                    class="text-[10px] font-bold text-white"
                  >SSO</span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold">
                    {{ PROVIDER_META[active.provider].label }}
                  </p>
                  <a
                    :href="PROVIDER_META[active.provider].docsUrl"
                    target="_blank"
                    rel="noopener"
                    class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink
                      class="size-2.5"
                      :stroke-width="1.75"
                    />
                    Setup docs
                  </a>
                </div>
                <!-- Enable toggle -->
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground">{{ active.enabled ? 'Enabled' : 'Disabled' }}</span>
                  <button
                    class="relative shrink-0 w-9 h-5 rounded-full transition-colors"
                    :class="active.enabled ? 'bg-primary' : 'bg-muted'"
                    @click="active.enabled = !active.enabled"
                  >
                    <div :class="['absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform', active.enabled ? 'translate-x-4' : 'translate-x-0.5']" />
                  </button>
                </div>
                <button
                  class="size-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors ml-1"
                  @click="closePanel"
                >
                  <X
                    class="size-4 text-muted-foreground"
                    :stroke-width="1.75"
                  />
                </button>
              </div>

              <!-- Fields -->
              <div class="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                <div class="space-y-1">
                  <label class="text-xs text-muted-foreground">Client ID</label>
                  <input
                    v-model="active.clientId"
                    type="text"
                    placeholder="Client ID"
                    :class="INPUT"
                  >
                </div>
                <div class="space-y-1">
                  <label class="text-xs text-muted-foreground">Client Secret{{ active.hasClientSecret ? ' (stored)' : '' }}</label>
                  <input
                    v-model="active.clientSecret"
                    type="password"
                    :placeholder="active.hasClientSecret ? 'Leave blank to keep existing' : 'Client Secret'"
                    :class="INPUT"
                  >
                </div>

                <!-- GitHub: org restriction -->
                <div
                  v-if="active.provider === 'github'"
                  class="space-y-1"
                >
                  <label class="text-xs text-muted-foreground">Allowed org <span class="opacity-50">(optional)</span></label>
                  <input
                    v-model="active.allowedOrg"
                    type="text"
                    placeholder="my-org"
                    :class="INPUT"
                  >
                  <p class="text-xs text-muted-foreground/60">
                    Restrict sign-in to members of this GitHub organization.
                  </p>
                </div>

                <!-- Microsoft: tenant ID -->
                <div
                  v-if="active.provider === 'microsoft'"
                  class="space-y-1"
                >
                  <label class="text-xs text-muted-foreground">Tenant ID <span class="opacity-50">(leave blank for multi-tenant)</span></label>
                  <input
                    v-model="active.providerTenantId"
                    type="text"
                    placeholder="common"
                    :class="INPUT"
                  >
                </div>

                <!-- GitLab: base URL -->
                <div
                  v-if="active.provider === 'gitlab'"
                  class="space-y-1"
                >
                  <label class="text-xs text-muted-foreground">GitLab URL <span class="opacity-50">(leave blank for gitlab.com)</span></label>
                  <input
                    v-model="active.providerBaseUrl"
                    type="url"
                    placeholder="https://gitlab.example.com"
                    :class="INPUT"
                  >
                </div>

                <!-- Okta: domain -->
                <div
                  v-if="active.provider === 'okta'"
                  class="space-y-1"
                >
                  <label class="text-xs text-muted-foreground">Okta domain</label>
                  <input
                    v-model="active.providerBaseUrl"
                    type="text"
                    placeholder="mycompany.okta.com"
                    :class="INPUT"
                  >
                </div>

                <!-- Domain restriction (all except GitHub) -->
                <div
                  v-if="active.provider !== 'github'"
                  class="space-y-1"
                >
                  <label class="text-xs text-muted-foreground">Allowed domain <span class="opacity-50">(optional)</span></label>
                  <input
                    v-model="active.allowedDomain"
                    type="text"
                    placeholder="mycompany.com"
                    :class="INPUT"
                  >
                  <p class="text-xs text-muted-foreground/60">
                    Only email addresses from this domain can sign in.
                  </p>
                </div>

                <!-- Custom SSO extra fields -->
                <template v-if="active.provider === 'custom'">
                  <div class="space-y-1">
                    <label class="text-xs text-muted-foreground">Display name</label>
                    <input
                      v-model="active.customName"
                      type="text"
                      placeholder="Authentik"
                      :class="INPUT"
                    >
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs text-muted-foreground">Authorization URL</label>
                    <input
                      v-model="active.customAuthorizationUrl"
                      type="url"
                      placeholder="https://…/authorize/"
                      :class="INPUT"
                    >
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs text-muted-foreground">Token URL</label>
                    <input
                      v-model="active.customTokenUrl"
                      type="url"
                      placeholder="https://…/token/"
                      :class="INPUT"
                    >
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs text-muted-foreground">Userinfo URL</label>
                    <input
                      v-model="active.customUserinfoUrl"
                      type="url"
                      placeholder="https://…/userinfo/"
                      :class="INPUT"
                    >
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs text-muted-foreground">Scopes</label>
                    <input
                      v-model="active.customScopes"
                      type="text"
                      placeholder="openid email profile"
                      :class="INPUT"
                    >
                  </div>
                </template>
              </div>

              <!-- Footer -->
              <div class="px-5 pb-5">
                <p
                  v-if="active.saveError"
                  class="text-xs text-red-500 mb-3"
                >
                  {{ active.saveError }}
                </p>
                <button
                  :disabled="active.saving"
                  class="w-full py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  :class="active.saved ? 'bg-green-500/10 text-green-500' : 'bg-primary text-primary-foreground hover:bg-primary/90'"
                  @click="saveProvider"
                >
                  {{ active.saving ? 'Saving...' : active.saved ? 'Saved!' : 'Save' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
