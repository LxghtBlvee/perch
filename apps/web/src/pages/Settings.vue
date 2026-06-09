<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Eye, EyeOff, Check } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useColorMode, type ColorMode } from '@/composables/useColorMode'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const { mode: colorMode, setMode } = useColorMode()
const toast = useToast()

const COLOR_MODES: { value: ColorMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
]

// Profile
const name = ref(auth.user?.name ?? '')
const savingProfile = ref(false)

// Password
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showCurrent = ref(false)
const showNew = ref(false)
const savingPassword = ref(false)

onMounted(() => {
  name.value = auth.user?.name ?? ''
})

async function saveProfile() {
  savingProfile.value = true
  try {
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ name: name.value }),
    })
    if (res.ok) {
      const updated = await res.json() as typeof auth.user
      if (auth.user && updated) Object.assign(auth.user, updated)
      toast.success('Profile updated')
    } else {
      const d = await res.json() as { error?: string }
      toast.error(d.error ?? 'Failed to update profile')
    }
  } finally {
    savingProfile.value = false
  }
}

async function savePassword() {
  if (newPassword.value !== confirmPassword.value) {
    toast.error('New passwords do not match')
    return
  }
  if (newPassword.value.length < 8) {
    toast.error('Password must be at least 8 characters')
    return
  }
  savingPassword.value = true
  try {
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ currentPassword: currentPassword.value, newPassword: newPassword.value }),
    })
    if (res.ok) {
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
      toast.success('Password changed')
    } else {
      const d = await res.json() as { error?: string }
      toast.error(d.error ?? 'Failed to change password')
    }
  } finally {
    savingPassword.value = false
  }
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50'
</script>

<template>
  <div class="p-6 space-y-8 max-w-2xl">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">
        Settings
      </h1>
      <p class="text-sm text-muted-foreground mt-1">
        Your account and preferences.
      </p>
    </div>

    <!-- Appearance -->
    <section class="space-y-3">
      <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Appearance
      </h2>
      <div class="rounded-xl border border-border bg-card p-5">
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
    <section class="space-y-3">
      <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Profile
      </h2>
      <div class="rounded-xl border border-border bg-card p-5 space-y-4">
        <div class="flex items-center gap-4">
          <div class="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            <img
              v-if="auth.user?.avatarUrl"
              :src="auth.user.avatarUrl"
              class="size-12 object-cover"
            >
            <span
              v-else
              class="text-lg font-semibold text-primary"
            >
              {{ (auth.user?.name ?? auth.user?.email ?? '?')[0].toUpperCase() }}
            </span>
          </div>
          <div class="text-sm">
            <p class="font-medium">
              {{ auth.user?.name ?? auth.user?.email }}
            </p>
            <p class="text-muted-foreground text-xs">
              {{ auth.user?.email }}
            </p>
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
          class="px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
          @click="saveProfile"
        >
          {{ savingProfile ? 'Saving...' : 'Save profile' }}
        </button>
      </div>
    </section>

    <!-- Password — hidden for seeded admin (no passwordHash / OAuth-only) and when no password set -->
    <section
      v-if="auth.user?.hasPassword && !auth.user?.seeded"
      class="space-y-3"
    >
      <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Password
      </h2>
      <div class="rounded-xl border border-border bg-card p-5 space-y-4">
        <div class="space-y-1">
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
          :disabled="savingPassword || !currentPassword || !newPassword || !confirmPassword"
          class="px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
          @click="savePassword"
        >
          {{ savingPassword ? 'Changing...' : 'Change password' }}
        </button>
      </div>
    </section>
  </div>
</template>
