<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

interface EnabledProvider { provider: string; customName: string | null }

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const loading = ref(false)

// Pick up OAuth error redirects e.g. ?error=org_required&org=my-org
const urlError = new URLSearchParams(location.search).get('error')
const urlOrg = new URLSearchParams(location.search).get('org')
const urlDomain = new URLSearchParams(location.search).get('domain')
const oauthError = ref(
  urlError === 'org_required' ? `Access restricted to members of the "${urlOrg}" GitHub org.`
  : urlError === 'domain_required' ? `Access restricted to @${urlDomain} email addresses.`
  : ''
)
if (urlError) history.replaceState({}, '', '/login')

const error = ref('')

// /api/auth/providers already returns only enabled providers
const providers = ref<EnabledProvider[]>([])

onMounted(async () => {
  const res = await fetch('/api/auth/providers').catch(() => null)
  if (res?.ok) providers.value = await res.json()
})

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    router.push('/')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Login failed'
  } finally {
    loading.value = false
  }
}

function oauthLogin(provider: string) {
  window.location.href = `/api/auth/${provider}`
}

const PROVIDER_LABELS: Record<string, string> = {
  github: 'GitHub',
  google: 'Google',
  gitlab: 'GitLab',
  microsoft: 'Microsoft',
  okta: 'Okta',
  discord: 'Discord',
}

const PROVIDER_ICONS: Record<string, string> = {
  github: '/icons/github.svg',
  google: '/icons/google.svg',
  gitlab: '/icons/gitlab.svg',
  microsoft: '/icons/microsoft.svg',
  okta: '/icons/okta.svg',
  discord: '/icons/discord.svg',
}

function providerLabel(p: EnabledProvider): string {
  if (p.provider === 'custom') return p.customName ?? 'SSO'
  return PROVIDER_LABELS[p.provider] ?? p.customName ?? p.provider
}

function providerIcon(p: EnabledProvider): string {
  return PROVIDER_ICONS[p.provider] ?? '/icons/sso.svg'
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="w-full max-w-sm space-y-6 px-4">
      <!-- Logo -->
      <div class="flex flex-col items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 400"
          fill="none"
          class="w-48"
          aria-label="Perch"
        >
          <g transform="translate(180 60) scale(2.8)">
            <line
              x1="2"
              y1="80"
              x2="98"
              y2="80"
              stroke="#7dd3c0"
              stroke-width="1.8"
              stroke-linecap="round"
            />
            <path
              fill="#7dd3c0"
              fill-rule="evenodd"
              d="M 22 58 C 14 50 16 38 26 34 C 30 24 46 20 58 24 C 64 18 76 20 78 28 C 80 30 82 33 82 36 L 92 38 L 94 40 L 84 43 C 82 48 76 52 68 54 C 64 60 56 62 48 62 L 30 62 L 12 60 L 22 58 Z M 70 30.5 a 1.5 1.5 0 1 0 0 3 a 1.5 1.5 0 1 0 0 -3 Z"
            />
            <line
              x1="40"
              y1="62"
              x2="40"
              y2="80"
              stroke="#7dd3c0"
              stroke-width="1.6"
              stroke-linecap="round"
            />
            <line
              x1="52"
              y1="62"
              x2="52"
              y2="80"
              stroke="#7dd3c0"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </g>
          <g transform="translate(494.875 284) scale(2.15)">
            <path
              fill="#7dd3c0"
              d="M7.5 15L7.5 -53.2L17.5 -53.2L17.8 -41.8L16.6 -42.4Q18.6 -48.3 23.2 -51.35Q27.8 -54.4 33.8 -54.4Q41.6 -54.4 46.65 -50.55Q51.7 -46.7 54.15 -40.4Q56.6 -34.1 56.6 -26.6Q56.6 -19.1 54.15 -12.8Q51.7 -6.5 46.65 -2.65Q41.6 1.2 33.8 1.2Q29.8 1.2 26.3 -0.2Q22.8 -1.6 20.35 -4.15Q17.9 -6.7 16.9 -10.2L18.1 -11.4L18.1 15ZM31.9 -8Q38.3 -8 41.95 -12.9Q45.6 -17.8 45.6 -26.6Q45.6 -35.4 41.95 -40.3Q38.3 -45.2 31.9 -45.2Q27.7 -45.2 24.6 -43.15Q21.5 -41.1 19.8 -36.9Q18.1 -32.7 18.1 -26.6Q18.1 -20.5 19.75 -16.3Q21.4 -12.1 24.55 -10.05Q27.7 -8 31.9 -8Z M85.7 1.2Q77.9 1.2 72.25 -2.2Q66.6 -5.6 63.55 -11.9Q60.5 -18.2 60.5 -26.6Q60.5 -35 63.55 -41.25Q66.6 -47.5 72.2 -50.95Q77.8 -54.4 85.4 -54.4Q92.6 -54.4 98.1 -51.05Q103.6 -47.7 106.65 -41.4Q109.7 -35.1 109.7 -26.2L109.7 -23.5L71.5 -23.5Q71.9 -15.7 75.65 -11.8Q79.4 -7.9 85.8 -7.9Q90.5 -7.9 93.6 -10.1Q96.7 -12.3 97.9 -16L108.9 -15.3Q106.8 -7.9 100.65 -3.35Q94.5 1.2 85.7 1.2ZM71.5 -31.5L98.5 -31.5Q98 -38.6 94.45 -42Q90.9 -45.4 85.4 -45.4Q79.7 -45.4 76.05 -41.85Q72.4 -38.3 71.5 -31.5Z M116.9 0L116.9 -53.2L126.6 -53.2L127 -39.1L126.1 -39.4Q127.2 -46.6 130.55 -49.9Q133.9 -53.2 139.6 -53.2L144.7 -53.2L144.7 -43.7L139.6 -43.7Q135.6 -43.7 132.9 -42.4Q130.2 -41.1 128.85 -38.4Q127.5 -35.7 127.5 -31.4L127.5 0Z M170.7 1.2Q163.1 1.2 157.4 -2.2Q151.7 -5.6 148.6 -11.9Q145.5 -18.2 145.5 -26.6Q145.5 -35 148.6 -41.25Q151.7 -47.5 157.4 -50.95Q163.1 -54.4 170.7 -54.4Q177.2 -54.4 182.25 -52.15Q187.3 -49.9 190.45 -45.6Q193.6 -41.3 194.5 -35.1L183.4 -34.5Q182.6 -39.7 179.2 -42.45Q175.8 -45.2 170.7 -45.2Q164 -45.2 160.25 -40.25Q156.5 -35.3 156.5 -26.6Q156.5 -17.9 160.25 -12.95Q164 -8 170.7 -8Q175.8 -8 179.2 -10.85Q182.6 -13.7 183.4 -19.5L194.5 -18.9Q193.6 -12.8 190.45 -8.3Q187.3 -3.8 182.25 -1.3Q177.2 1.2 170.7 1.2Z M200.6 0L200.6 -71L211.2 -71L211.2 -41.2L209.9 -41.4Q210.8 -45.9 213.2 -48.75Q215.6 -51.6 219.1 -53Q222.6 -54.4 226.8 -54.4Q232.6 -54.4 236.6 -51.85Q240.6 -49.3 242.65 -44.7Q244.7 -40.1 244.7 -34.2L244.7 0L234.1 0L234.1 -31.4Q234.1 -38.6 231.65 -42.05Q229.2 -45.5 224 -45.5Q218.2 -45.5 214.7 -41.85Q211.2 -38.2 211.2 -31.2L211.2 0Z"
            />
          </g>
        </svg>
        <p class="text-sm text-muted-foreground">
          Sign in to continue
        </p>
      </div>

      <!-- OAuth redirect error -->
      <div
        v-if="oauthError"
        class="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 text-center"
      >
        {{ oauthError }}
      </div>

      <!-- Form -->
      <form
        class="space-y-3"
        @submit.prevent="handleLogin"
      >
        <div class="space-y-2">
          <input
            v-model="email"
            type="email"
            placeholder="Email"
            required
            autocomplete="email"
            class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
          <input
            v-model="password"
            type="password"
            placeholder="Password"
            required
            autocomplete="current-password"
            class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
        </div>

        <p
          v-if="error"
          class="text-xs text-red-500"
        >
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {{ loading ? 'Signing in...' : 'Sign in' }}
        </button>
      </form>

      <!-- OAuth providers -->
      <template v-if="providers.length > 0">
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-border" />
          </div>
          <div class="relative flex justify-center text-xs">
            <span class="bg-background px-2 text-muted-foreground">or continue with</span>
          </div>
        </div>

        <div class="space-y-2">
          <button
            v-for="p in providers"
            :key="p.provider"
            type="button"
            class="w-full py-2 px-4 rounded-lg border border-border bg-background text-sm font-medium hover:bg-accent transition-colors flex items-center justify-center gap-2.5"
            @click="oauthLogin(p.provider)"
          >
            <img
              :src="providerIcon(p)"
              class="size-4"
              :alt="providerLabel(p)"
            >
            {{ providerLabel(p) }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>