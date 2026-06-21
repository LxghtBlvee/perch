<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Eye, EyeOff, Check, Palette, User, ShieldCheck, Link2, Upload, Trash2,
  SlidersHorizontal, TriangleAlert, Monitor, LogOut, Plus,
} from 'lucide-vue-next'
import type { AuthUser } from '@perch/types'
import { useAuthStore } from '@/stores/auth'
import { useColorMode, type ColorMode } from '@/composables/useColorMode'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useUserPrefs, formatDateTime, supportedTimezones, type TimeFormat } from '@/composables/useUserPrefs'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { mode: colorMode, setMode } = useColorMode()
const toast = useToast()
const { confirm } = useConfirm()
const { timezone, timeFormat, toastsEnabled } = useUserPrefs()

const COLOR_MODES: { value: ColorMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
]
const TIME_FORMATS: { value: TimeFormat; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: '12', label: '12-hour' },
  { value: '24', label: '24-hour' },
]
const tzList = supportedTimezones()

// Sticky section nav (matches the admin Instance page).
const SECTIONS = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'account', label: 'Account', icon: ShieldCheck },
  { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  { id: 'connections', label: 'Connected accounts', icon: Link2 },
  { id: 'danger', label: 'Danger zone', icon: TriangleAlert },
] as const
const active = ref<(typeof SECTIONS)[number]['id']>('appearance')

// Provider presentation for connected accounts.
const PROVIDER_META: Record<string, { label: string; icon: string; bg: string }> = {
  github:    { label: 'GitHub',     icon: '/icons/github.svg',    bg: 'bg-[#161b22]' },
  google:    { label: 'Google',     icon: '/icons/google.svg',    bg: 'bg-white' },
  microsoft: { label: 'Microsoft',  icon: '/icons/microsoft.svg', bg: 'bg-[#f3f3f3]' },
  gitlab:    { label: 'GitLab',     icon: '/icons/gitlab.svg',    bg: 'bg-[#1a1a2e]' },
  discord:   { label: 'Discord',    icon: '/icons/discord.svg',   bg: 'bg-[#5865f2]' },
  okta:      { label: 'Okta',       icon: '/icons/okta.svg',      bg: 'bg-[#00297a]' },
  custom:    { label: 'Custom SSO', icon: '/icons/sso.svg',       bg: 'bg-primary/20' },
}
function provMeta(p: string) {
  return PROVIDER_META[p] ?? { label: p, icon: '', bg: 'bg-muted' }
}

// Profile
const name = ref(auth.user?.name ?? '')
const savingProfile = ref(false)

// Avatar
const avatarInput = ref<HTMLInputElement | null>(null)
const uploadingAvatar = ref(false)

// Account: email
const email = ref(auth.user?.email ?? '')
const emailPassword = ref('')
const savingEmail = ref(false)

// Account: password
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showCurrent = ref(false)
const showNew = ref(false)
const savingPassword = ref(false)

// Account: sessions
interface SessionInfo { id: string; createdAt: string; expiresAt: string; current: boolean }
const sessions = ref<SessionInfo[]>([])
const loadingSessions = ref(true)
const signingOut = ref(false)

// Connections
const connections = ref<{ provider: string; connectedAt: string }[]>([])
const loadingConnections = ref(true)
const enabledProviders = ref<{ provider: string; customName: string | null }[]>([])
const connecting = ref<string | null>(null)

const availableToConnect = computed(() =>
  enabledProviders.value.filter(p => !connections.value.some(c => c.provider === p.provider)),
)

// Danger zone
const deleting = ref(false)

onMounted(() => {
  name.value = auth.user?.name ?? ''
  email.value = auth.user?.email ?? ''
  void loadConnections()
  void loadProviders()
  void loadSessions()

  // Returning from a "connect account" OAuth round-trip.
  if (route.query.linked) {
    toast.success(`Connected ${provMeta(String(route.query.linked)).label}`)
  } else if (route.query.link_error === 'in_use') {
    toast.error('That account is already linked to another user.')
  }
  if (route.query.linked || route.query.link_error) {
    void router.replace({ query: {} })
  }
})

async function loadConnections() {
  loadingConnections.value = true
  try {
    const res = await fetch('/api/auth/me/connections', { headers: { Authorization: `Bearer ${auth.token}` } })
    if (res.ok) connections.value = await res.json() as typeof connections.value
  } finally {
    loadingConnections.value = false
  }
}

async function loadProviders() {
  const res = await fetch('/api/auth/providers').catch(() => null)
  if (res?.ok) enabledProviders.value = await res.json() as typeof enabledProviders.value
}

async function loadSessions() {
  loadingSessions.value = true
  try {
    const res = await fetch('/api/auth/me/sessions', { headers: { Authorization: `Bearer ${auth.token}` } })
    if (res.ok) sessions.value = await res.json() as SessionInfo[]
  } finally {
    loadingSessions.value = false
  }
}

async function saveProfile() {
  savingProfile.value = true
  try {
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ name: name.value }),
    })
    if (res.ok) {
      auth.updateUser(await res.json() as AuthUser)
      toast.success('Profile updated')
    } else {
      const d = await res.json() as { error?: string }
      toast.error(d.error ?? 'Failed to update profile')
    }
  } finally {
    savingProfile.value = false
  }
}

function pickAvatar() {
  avatarInput.value?.click()
}

async function onAvatarChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  // Client-side guard so unsupported types fail fast with a clear message.
  const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  if (!ALLOWED.includes(file.type)) {
    toast.error('Unsupported file type. Use PNG, JPG, GIF, or WebP.')
    if (avatarInput.value) avatarInput.value.value = ''
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    toast.error('Image must be under 2 MB.')
    if (avatarInput.value) avatarInput.value.value = ''
    return
  }
  uploadingAvatar.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/auth/me/avatar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
      body: fd,
    })
    if (res.ok) {
      auth.updateUser(await res.json() as AuthUser)
      toast.success('Avatar updated')
    } else {
      const d = await res.json() as { error?: string }
      toast.error(d.error ?? 'Upload failed')
    }
  } finally {
    uploadingAvatar.value = false
    if (avatarInput.value) avatarInput.value.value = ''
  }
}

async function saveEmail() {
  if (email.value === auth.user?.email) { toast.error('Email is unchanged'); return }
  savingEmail.value = true
  try {
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ email: email.value, currentPassword: emailPassword.value }),
    })
    if (res.ok) {
      auth.updateUser(await res.json() as AuthUser)
      emailPassword.value = ''
      toast.success('Email updated')
    } else {
      const d = await res.json() as { error?: string }
      toast.error(d.error ?? 'Failed to update email')
    }
  } finally {
    savingEmail.value = false
  }
}

async function savePassword() {
  if (newPassword.value !== confirmPassword.value) { toast.error('New passwords do not match'); return }
  if (newPassword.value.length < 8) { toast.error('Password must be at least 8 characters'); return }
  savingPassword.value = true
  try {
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ currentPassword: currentPassword.value, newPassword: newPassword.value }),
    })
    if (res.ok) {
      auth.updateUser(await res.json() as AuthUser)
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
      toast.success(auth.user?.hasPassword ? 'Password changed' : 'Password set')
    } else {
      const d = await res.json() as { error?: string }
      toast.error(d.error ?? 'Failed to change password')
    }
  } finally {
    savingPassword.value = false
  }
}

async function connect(provider: string) {
  connecting.value = provider
  try {
    const res = await fetch('/api/auth/link/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (!res.ok) { toast.error('Could not start the connect flow'); return }
    const { token } = await res.json() as { token: string }
    window.location.href = `/api/auth/${provider}?link=${encodeURIComponent(token)}`
  } catch {
    toast.error('Could not start the connect flow')
  } finally {
    connecting.value = null
  }
}

async function disconnect(provider: string) {
  const res = await fetch(`/api/auth/me/connections/${provider}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  if (res.ok) {
    connections.value = connections.value.filter(c => c.provider !== provider)
    toast.success(`Disconnected ${provMeta(provider).label}`)
  } else {
    const d = await res.json() as { error?: string }
    toast.error(d.error ?? 'Failed to disconnect')
  }
}

async function signOutOthers() {
  signingOut.value = true
  try {
    const res = await fetch('/api/auth/me/sessions/others', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (res.ok) {
      const { count } = await res.json() as { count: number }
      toast.success(count ? `Signed out ${count} other session${count === 1 ? '' : 's'}` : 'No other sessions')
      await loadSessions()
    } else {
      toast.error('Failed to sign out other sessions')
    }
  } finally {
    signingOut.value = false
  }
}

async function deleteAccount() {
  const ok = await confirm({
    title: 'Delete your account?',
    message: 'This permanently deletes your account, sessions, and connected logins. This cannot be undone.',
    confirmLabel: 'Delete account',
    danger: true,
  })
  if (!ok) return
  deleting.value = true
  try {
    const res = await fetch('/api/auth/me', { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } })
    if (res.ok) {
      await auth.logout()
      router.push('/login')
    } else {
      const d = await res.json() as { error?: string }
      toast.error(d.error ?? 'Failed to delete account')
    }
  } finally {
    deleting.value = false
  }
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50'
const BTN = 'px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50'
const CARD = 'rounded-xl border border-border bg-card p-5'
const TOGGLE = 'relative shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5'
const KNOB = 'absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform'
</script>

<template>
  <div class="p-6 pb-12">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">
        Settings
      </h1>
      <p class="text-sm text-muted-foreground mt-1">
        Your account and preferences.
      </p>
    </div>

    <div class="flex gap-8 mt-6">
      <!-- Sticky section nav -->
      <nav class="w-52 shrink-0 sticky top-6 self-start space-y-0.5">
        <button
          v-for="s in SECTIONS"
          :key="s.id"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
          :class="active === s.id
            ? (s.id === 'danger' ? 'bg-destructive/10 text-destructive font-medium' : 'bg-primary/10 text-primary font-medium')
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
          @click="active = s.id"
        >
          <component
            :is="s.icon"
            class="size-4 shrink-0"
            :stroke-width="1.75"
          />
          {{ s.label }}
        </button>
      </nav>

      <!-- Content panel -->
      <div class="flex-1 min-w-0 max-w-2xl">
        <!-- Appearance -->
        <section v-show="active === 'appearance'">
          <div :class="CARD">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-medium">
                  Color mode
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Choose light, dark, or follow your OS.
                </p>
              </div>
              <div class="flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
                <button
                  v-for="m in COLOR_MODES"
                  :key="m.value"
                  class="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                  :class="colorMode === m.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                  @click="setMode(m.value)"
                >
                  {{ m.label }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Profile -->
        <section v-show="active === 'profile'">
          <div :class="CARD + ' space-y-4'">
            <div class="flex items-center gap-4">
              <div class="size-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  v-if="auth.user?.avatarUrl"
                  :src="auth.user.avatarUrl"
                  class="size-16 object-cover"
                >
                <span
                  v-else
                  class="text-xl font-semibold text-primary"
                >
                  {{ (auth.user?.name ?? auth.user?.email ?? '?')[0].toUpperCase() }}
                </span>
              </div>
              <div class="space-y-2">
                <div class="text-sm">
                  <p class="font-medium">
                    {{ auth.user?.name ?? auth.user?.email }}
                  </p>
                  <p class="text-muted-foreground text-xs">
                    {{ auth.user?.email }}
                  </p>
                </div>
                <button
                  :disabled="uploadingAvatar"
                  class="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50"
                  @click="pickAvatar"
                >
                  <Upload
                    class="size-3.5"
                    :stroke-width="1.75"
                  />
                  {{ uploadingAvatar ? 'Uploading…' : 'Upload picture' }}
                </button>
                <input
                  ref="avatarInput"
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  class="hidden"
                  @change="onAvatarChange"
                >
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-xs text-muted-foreground">Display name</label>
              <input
                v-model="name"
                type="text"
                placeholder="Your name"
                :class="INPUT"
              >
            </div>

            <button
              :disabled="savingProfile"
              :class="BTN"
              @click="saveProfile"
            >
              {{ savingProfile ? 'Saving...' : 'Save profile' }}
            </button>
          </div>
        </section>

        <!-- Account -->
        <section
          v-show="active === 'account'"
          class="space-y-6"
        >
          <!-- Email -->
          <div :class="CARD + ' space-y-4'">
            <div>
              <h3 class="text-sm font-medium">
                Email address
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                Used to sign in and receive account notifications.
              </p>
            </div>
            <div class="space-y-1">
              <label class="text-xs text-muted-foreground">Email</label>
              <input
                v-model="email"
                type="email"
                placeholder="you@example.com"
                :class="INPUT"
              >
            </div>
            <div
              v-if="email !== auth.user?.email"
              class="space-y-1"
            >
              <label class="text-xs text-muted-foreground">Current password</label>
              <input
                v-model="emailPassword"
                type="password"
                placeholder="Confirm with your password"
                :class="INPUT"
              >
              <p class="text-xs text-muted-foreground/60">
                Changing your email requires your current password.
              </p>
            </div>
            <button
              :disabled="savingEmail || email === auth.user?.email"
              :class="BTN"
              @click="saveEmail"
            >
              {{ savingEmail ? 'Saving...' : 'Update email' }}
            </button>
          </div>

          <!-- Password -->
          <div
            v-if="!auth.user?.seeded"
            :class="CARD + ' space-y-4'"
          >
            <div>
              <h3 class="text-sm font-medium">
                {{ auth.user?.hasPassword ? 'Change password' : 'Set a password' }}
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ auth.user?.hasPassword
                  ? 'Update the password you use to sign in.'
                  : 'Add a password so you can sign in without a connected account.' }}
              </p>
            </div>
            <div
              v-if="auth.user?.hasPassword"
              class="space-y-1"
            >
              <label class="text-xs text-muted-foreground">Current password</label>
              <div class="relative">
                <input
                  v-model="currentPassword"
                  :type="showCurrent ? 'text' : 'password'"
                  placeholder="••••••••"
                  :class="INPUT + ' pr-10'"
                >
                <button
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  @click="showCurrent = !showCurrent"
                >
                  <Eye
                    v-if="!showCurrent"
                    class="size-4"
                    :stroke-width="1.75"
                  />
                  <EyeOff
                    v-else
                    class="size-4"
                    :stroke-width="1.75"
                  />
                </button>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">New password</label>
                <div class="relative">
                  <input
                    v-model="newPassword"
                    :type="showNew ? 'text' : 'password'"
                    placeholder="••••••••"
                    :class="INPUT + ' pr-10'"
                  >
                  <button
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    @click="showNew = !showNew"
                  >
                    <Eye
                      v-if="!showNew"
                      class="size-4"
                      :stroke-width="1.75"
                    />
                    <EyeOff
                      v-else
                      class="size-4"
                      :stroke-width="1.75"
                    />
                  </button>
                </div>
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">Confirm new password</label>
                <div class="relative">
                  <input
                    v-model="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    :class="INPUT"
                  >
                  <Check
                    v-if="confirmPassword && confirmPassword === newPassword"
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-green-500 pointer-events-none"
                    :stroke-width="2"
                  />
                </div>
              </div>
            </div>
            <button
              :disabled="savingPassword || (auth.user?.hasPassword && !currentPassword) || !newPassword || !confirmPassword"
              :class="BTN"
              @click="savePassword"
            >
              {{ savingPassword ? 'Saving...' : auth.user?.hasPassword ? 'Change password' : 'Set password' }}
            </button>
          </div>

          <!-- Active sessions -->
          <div :class="CARD + ' space-y-4'">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-sm font-medium">
                  Active sessions
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Devices currently signed in to your account.
                </p>
              </div>
              <button
                v-if="sessions.length > 1"
                :disabled="signingOut"
                class="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50 shrink-0"
                @click="signOutOthers"
              >
                <LogOut
                  class="size-3.5"
                  :stroke-width="1.75"
                />
                Sign out others
              </button>
            </div>

            <div
              v-if="loadingSessions"
              class="space-y-2"
            >
              <div
                v-for="i in 2"
                :key="i"
                class="h-12 rounded-lg border border-border bg-muted/30 animate-pulse"
              />
            </div>
            <div
              v-else
              class="space-y-2"
            >
              <div
                v-for="s in sessions"
                :key="s.id"
                class="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <Monitor
                  class="size-4 text-muted-foreground shrink-0"
                  :stroke-width="1.75"
                />
                <div class="flex-1 min-w-0 text-xs">
                  <p class="font-medium">
                    Session started {{ formatDateTime(s.createdAt) }}
                  </p>
                  <p class="text-muted-foreground">
                    Expires {{ formatDateTime(s.expiresAt) }}
                  </p>
                </div>
                <span
                  v-if="s.current"
                  class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 shrink-0"
                >This device</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Preferences -->
        <section
          v-show="active === 'preferences'"
          class="space-y-6"
        >
          <div :class="CARD + ' space-y-4'">
            <div>
              <h3 class="text-sm font-medium">
                Date &amp; time
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                How timestamps are displayed across the app.
              </p>
            </div>
            <div class="space-y-1">
              <label class="text-xs text-muted-foreground">Timezone</label>
              <select
                v-model="timezone"
                :class="INPUT"
              >
                <option value="">
                  System default
                </option>
                <option
                  v-for="tz in tzList"
                  :key="tz"
                  :value="tz"
                >
                  {{ tz }}
                </option>
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-xs text-muted-foreground">Time format</label>
              <div class="flex items-center gap-1 rounded-lg border border-border bg-muted p-1 w-fit">
                <button
                  v-for="f in TIME_FORMATS"
                  :key="f.value"
                  class="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                  :class="timeFormat === f.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                  @click="timeFormat = f.value"
                >
                  {{ f.label }}
                </button>
              </div>
            </div>
            <p class="text-xs text-muted-foreground/60">
              Preview: {{ formatDateTime(Date.now()) }}
            </p>
          </div>

          <div :class="CARD">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h3 class="text-sm font-medium">
                  Notifications
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Show toast notifications for actions. Errors are always shown.
                </p>
              </div>
              <button
                :class="[TOGGLE, toastsEnabled ? 'bg-primary' : 'bg-muted']"
                @click="toastsEnabled = !toastsEnabled"
              >
                <div :class="[KNOB, toastsEnabled ? 'translate-x-4' : 'translate-x-0.5']" />
              </button>
            </div>
          </div>
        </section>

        <!-- Connected accounts -->
        <section v-show="active === 'connections'">
          <div :class="CARD + ' space-y-4'">
            <div>
              <h3 class="text-sm font-medium">
                Connected accounts
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                Sign-in methods linked to your account.
              </p>
            </div>

            <div
              v-if="loadingConnections"
              class="space-y-2"
            >
              <div
                v-for="i in 2"
                :key="i"
                class="h-14 rounded-lg border border-border bg-muted/30 animate-pulse"
              />
            </div>

            <template v-else>
              <p
                v-if="!connections.length"
                class="text-sm text-muted-foreground py-2"
              >
                No connected accounts yet.
              </p>
              <div
                v-else
                class="space-y-2"
              >
                <div
                  v-for="c in connections"
                  :key="c.provider"
                  class="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <div
                    class="size-9 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
                    :class="provMeta(c.provider).bg"
                  >
                    <img
                      v-if="provMeta(c.provider).icon"
                      :src="provMeta(c.provider).icon"
                      :alt="provMeta(c.provider).label"
                      class="size-5 object-contain"
                    >
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium">
                      {{ provMeta(c.provider).label }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      Connected {{ formatDateTime(c.connectedAt) }}
                    </p>
                  </div>
                  <button
                    class="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                    @click="disconnect(c.provider)"
                  >
                    <Trash2
                      class="size-3.5"
                      :stroke-width="1.75"
                    />
                    Disconnect
                  </button>
                </div>
              </div>

              <!-- Available providers to connect -->
              <div
                v-if="availableToConnect.length"
                class="pt-2 border-t border-border space-y-2"
              >
                <p class="text-xs text-muted-foreground">
                  Connect another account
                </p>
                <div
                  v-for="p in availableToConnect"
                  :key="p.provider"
                  class="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <div
                    class="size-9 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
                    :class="provMeta(p.provider).bg"
                  >
                    <img
                      v-if="provMeta(p.provider).icon"
                      :src="provMeta(p.provider).icon"
                      :alt="provMeta(p.provider).label"
                      class="size-5 object-contain"
                    >
                  </div>
                  <span class="flex-1 min-w-0 text-sm font-medium">
                    {{ p.provider === 'custom' && p.customName ? p.customName : provMeta(p.provider).label }}
                  </span>
                  <button
                    :disabled="connecting === p.provider"
                    class="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50"
                    @click="connect(p.provider)"
                  >
                    <Plus
                      class="size-3.5"
                      :stroke-width="1.75"
                    />
                    {{ connecting === p.provider ? 'Connecting…' : 'Connect' }}
                  </button>
                </div>
              </div>
            </template>
          </div>
        </section>

        <!-- Danger zone -->
        <section v-show="active === 'danger'">
          <div class="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
            <div>
              <h3 class="text-sm font-medium text-destructive">
                Delete account
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                Permanently delete your account, sessions, and connected logins. This cannot be undone.
              </p>
            </div>
            <button
              :disabled="deleting"
              class="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50"
              @click="deleteAccount"
            >
              <Trash2
                class="size-4"
                :stroke-width="1.75"
              />
              {{ deleting ? 'Deleting…' : 'Delete my account' }}
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
