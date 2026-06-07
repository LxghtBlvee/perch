<!-- apps/web/src/pages/Profile.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { AuthUser } from '@perch/types'

const auth = useAuthStore()

// Profile form
const profileForm = ref({
  name: auth.user?.name ?? '',
  email: auth.user?.email ?? '',
})
const profileSaving = ref(false)
const profileSuccess = ref(false)
const profileError = ref('')

async function saveProfile() {
  profileError.value = ''
  profileSuccess.value = false
  profileSaving.value = true
  try {
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({
        name: profileForm.value.name,
        email: profileForm.value.email,
      }),
    })
    const data = await res.json() as AuthUser & { error?: string }
    if (!res.ok) { profileError.value = data.error ?? 'Failed to save'; return }
    auth.updateUser(data)
    profileSuccess.value = true
    setTimeout(() => { profileSuccess.value = false }, 3000)
  } catch (e) {
    profileError.value = String(e)
  } finally {
    profileSaving.value = false
  }
}

// Password form
const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
const passwordSaving = ref(false)
const passwordSuccess = ref(false)
const passwordError = ref('')

async function savePassword() {
  passwordError.value = ''
  passwordSuccess.value = false
  if (!passwordForm.value.newPassword) { passwordError.value = 'New password is required.'; return }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordError.value = 'Passwords do not match.'; return
  }
  if (passwordForm.value.newPassword.length < 8) {
    passwordError.value = 'Password must be at least 8 characters.'; return
  }
  passwordSaving.value = true
  try {
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({
        currentPassword: passwordForm.value.currentPassword,
        newPassword: passwordForm.value.newPassword,
      }),
    })
    const data = await res.json() as AuthUser & { error?: string }
    if (!res.ok) { passwordError.value = data.error ?? 'Failed to update password'; return }
    auth.updateUser(data)
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
    passwordSuccess.value = true
    setTimeout(() => { passwordSuccess.value = false }, 3000)
  } catch (e) {
    passwordError.value = String(e)
  } finally {
    passwordSaving.value = false
  }
}

const hasPassword = computed(() => auth.user?.hasPassword ?? false)
</script>

<template>
  <div class="p-6 max-w-xl space-y-8">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Account</h1>
      <p class="text-sm text-muted-foreground mt-0.5">Manage your profile and password.</p>
    </div>

    <!-- Profile -->
    <section class="rounded-xl border border-border bg-card p-6 space-y-5">
      <h2 class="text-sm font-semibold">Profile</h2>

      <div class="space-y-1.5">
        <label class="text-xs font-medium text-muted-foreground">Display name</label>
        <input
          v-model="profileForm.name"
          type="text"
          placeholder="Your name"
          class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-medium text-muted-foreground">Email</label>
        <input
          v-model="profileForm.email"
          type="email"
          class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
      </div>

      <p v-if="profileError" class="text-xs text-red-400">{{ profileError }}</p>
      <p v-if="profileSuccess" class="text-xs text-green-400">Saved.</p>

      <button
        class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        :disabled="profileSaving"
        @click="saveProfile"
      >
        {{ profileSaving ? 'Saving…' : 'Save' }}
      </button>
    </section>

    <!-- Password -->
    <section class="rounded-xl border border-border bg-card p-6 space-y-5">
      <div>
        <h2 class="text-sm font-semibold">Password</h2>
        <p v-if="!hasPassword" class="text-xs text-muted-foreground mt-1">
          You signed in with OAuth. Set a password to enable email/password login.
        </p>
      </div>

      <div v-if="hasPassword" class="space-y-1.5">
        <label class="text-xs font-medium text-muted-foreground">Current password</label>
        <input
          v-model="passwordForm.currentPassword"
          type="password"
          class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-medium text-muted-foreground">New password</label>
        <input
          v-model="passwordForm.newPassword"
          type="password"
          class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-medium text-muted-foreground">Confirm new password</label>
        <input
          v-model="passwordForm.confirmPassword"
          type="password"
          class="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
      </div>

      <p v-if="passwordError" class="text-xs text-red-400">{{ passwordError }}</p>
      <p v-if="passwordSuccess" class="text-xs text-green-400">Password updated.</p>

      <button
        class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        :disabled="passwordSaving"
        @click="savePassword"
      >
        {{ passwordSaving ? 'Saving…' : hasPassword ? 'Update password' : 'Set password' }}
      </button>
    </section>
  </div>
</template>