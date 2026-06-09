<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Trash2, ShieldCheck, ShieldMinus, X, Copy, Check, RefreshCw } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import type { ManagedUser } from '@perch/types'

const auth = useAuthStore()
const { confirm } = useConfirm()
const users = ref<ManagedUser[]>([])
const loading = ref(true)
const showCreate = ref(false)

// Create form
const newEmail = ref('')
const newPassword = ref('')
const newName = ref('')
const newRole = ref<'member' | 'admin'>('member')
const createError = ref('')
const creating = ref(false)

// Detail panel
interface UserDetail {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  role: 'member' | 'admin'
  createdAt: string
  lastLoginAt: string | null
}

const selectedUser = ref<UserDetail | null>(null)
const detailLoading = ref(false)
const recoveryUrl = ref('')
const generatingRecovery = ref(false)
const copiedRecovery = ref(false)

async function fetchUsers() {
  const res = await fetch('/api/users', {
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  if (res.ok) users.value = await res.json()
}

onMounted(async () => {
  await fetchUsers()
  loading.value = false
})

async function openDetail(user: ManagedUser) {
  if (selectedUser.value?.id === user.id) {
    selectedUser.value = null
    recoveryUrl.value = ''
    return
  }
  recoveryUrl.value = ''
  detailLoading.value = true
  selectedUser.value = { id: user.id, email: user.email, name: user.name ?? null, avatarUrl: user.avatarUrl ?? null, role: user.role, createdAt: user.createdAt, lastLoginAt: null }
  const res = await fetch(`/api/users/${user.id}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  if (res.ok) {
    const data = await res.json() as UserDetail
    selectedUser.value = data
  }
  detailLoading.value = false
}

function closeDetail() {
  selectedUser.value = null
  recoveryUrl.value = ''
}

async function toggleRole(user: ManagedUser) {
  const newR = user.role === 'admin' ? 'member' : 'admin'
  await fetch(`/api/users/${user.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ role: newR }),
  })
  await fetchUsers()
  if (selectedUser.value?.id === user.id) selectedUser.value = { ...selectedUser.value, role: newR }
}

async function deleteUser(user: ManagedUser) {
  const ok = await confirm({ title: `Delete ${user.name ?? user.email}?`, message: 'This cannot be undone. The user will lose all access to Perch.', confirmLabel: 'Delete', danger: true })
  if (!ok) return
  await fetch(`/api/users/${user.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  if (selectedUser.value?.id === user.id) closeDetail()
  await fetchUsers()
}

async function createUser() {
  createError.value = ''
  creating.value = true
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({
        email: newEmail.value,
        password: newPassword.value,
        name: newName.value || undefined,
        role: newRole.value,
      }),
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      createError.value = data.error ?? 'Failed to create user'
      return
    }
    newEmail.value = ''
    newPassword.value = ''
    newName.value = ''
    newRole.value = 'member'
    showCreate.value = false
    await fetchUsers()
  } finally {
    creating.value = false
  }
}

async function generateRecoveryLink() {
  if (!selectedUser.value) return
  generatingRecovery.value = true
  recoveryUrl.value = ''
  const res = await fetch(`/api/users/${selectedUser.value.id}/recovery-token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  if (res.ok) {
    const data = await res.json() as { path: string }
    recoveryUrl.value = `${window.location.origin}${data.path}`
  }
  generatingRecovery.value = false
}

async function copyRecoveryLink() {
  await navigator.clipboard.writeText(recoveryUrl.value)
  copiedRecovery.value = true
  setTimeout(() => { copiedRecovery.value = false }, 2000)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="p-6 space-y-6 max-w-5xl">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          Users
        </h1>
        <p class="text-sm text-muted-foreground mt-1">
          Manage who has access to Perch.
        </p>
      </div>
      <button
        class="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
        @click="showCreate = !showCreate"
      >
        {{ showCreate ? 'Cancel' : 'Add user' }}
      </button>
    </div>

    <!-- Create form -->
    <div
      v-if="showCreate"
      class="rounded-xl border border-border bg-card p-5 space-y-3"
    >
      <h3 class="text-sm font-medium">
        New user
      </h3>
      <div class="grid grid-cols-2 gap-3">
        <input
          v-model="newEmail"
          type="email"
          placeholder="Email"
          class="px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
        <input
          v-model="newName"
          type="text"
          placeholder="Name (optional)"
          class="px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
        <input
          v-model="newPassword"
          type="password"
          placeholder="Password"
          class="px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
        <select
          v-model="newRole"
          class="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="member">
            Member
          </option>
          <option value="admin">
            Admin
          </option>
        </select>
      </div>
      <p
        v-if="createError"
        class="text-xs text-red-500"
      >
        {{ createError }}
      </p>
      <button
        :disabled="creating"
        class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        @click="createUser"
      >
        {{ creating ? 'Creating...' : 'Create user' }}
      </button>
    </div>

    <!-- Users table + detail panel side by side -->
    <div class="flex gap-4 items-start">
      <!-- Users table -->
      <div class="flex-1 rounded-xl border border-border bg-card divide-y divide-border">
        <div
          v-if="loading"
          class="p-8 text-center text-sm text-muted-foreground"
        >
          Loading...
        </div>
        <div
          v-for="user in users"
          :key="user.id"
          class="flex items-center gap-4 p-4 cursor-pointer hover:bg-accent/50 transition-colors"
          :class="selectedUser?.id === user.id ? 'bg-accent/50' : ''"
          @click="openDetail(user)"
        >
          <!-- Avatar -->
          <div class="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            <img
              v-if="user.avatarUrl"
              :src="user.avatarUrl"
              :alt="user.name ?? user.email"
              class="size-8 rounded-full object-cover"
            >
            <span
              v-else
              class="text-xs font-medium text-primary"
            >
              {{ (user.name ?? user.email)[0].toUpperCase() }}
            </span>
          </div>

          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">
              {{ user.name ?? user.email }}
            </p>
            <p
              v-if="user.name"
              class="text-xs text-muted-foreground truncate"
            >
              {{ user.email }}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <span
              :class="[
                'text-xs px-2 py-0.5 rounded-full font-medium',
                user.role === 'admin'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              ]"
            >
              {{ user.role }}
            </span>
            <span class="text-xs text-muted-foreground hidden sm:block">{{ formatDate(user.createdAt) }}</span>

            <!-- Actions (disabled for self) -->
            <div
              v-if="user.id !== auth.user?.id"
              class="flex items-center gap-1"
              @click.stop
            >
              <button
                class="size-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
                :title="user.role === 'admin' ? 'Demote to member' : 'Promote to admin'"
                @click="toggleRole(user)"
              >
                <ShieldCheck
                  v-if="user.role === 'member'"
                  class="size-4 text-muted-foreground"
                  :stroke-width="1.75"
                />
                <ShieldMinus
                  v-else
                  class="size-4 text-muted-foreground"
                  :stroke-width="1.75"
                />
              </button>
              <button
                class="size-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
                title="Delete user"
                @click="deleteUser(user)"
              >
                <Trash2
                  class="size-4 text-muted-foreground"
                  :stroke-width="1.75"
                />
              </button>
            </div>
            <div
              v-else
              class="size-8 flex items-center justify-center"
            >
              <span class="text-xs text-muted-foreground">you</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Detail panel -->
      <div
        v-if="selectedUser"
        class="w-72 shrink-0 rounded-xl border border-border bg-card p-5 space-y-5"
      >
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium">
            Account details
          </p>
          <button
            class="size-6 rounded flex items-center justify-center hover:bg-accent transition-colors"
            @click="closeDetail"
          >
            <X
              class="size-3.5 text-muted-foreground"
              :stroke-width="1.75"
            />
          </button>
        </div>

        <!-- Avatar + name -->
        <div class="flex flex-col items-center gap-3 py-2">
          <div class="size-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            <img
              v-if="selectedUser.avatarUrl"
              :src="selectedUser.avatarUrl"
              class="size-14 rounded-full object-cover"
            >
            <span
              v-else
              class="text-xl font-semibold text-primary"
            >
              {{ (selectedUser.name ?? selectedUser.email)[0].toUpperCase() }}
            </span>
          </div>
          <div class="text-center">
            <p class="text-sm font-medium">
              {{ selectedUser.name ?? selectedUser.email }}
            </p>
            <p
              v-if="selectedUser.name"
              class="text-xs text-muted-foreground"
            >
              {{ selectedUser.email }}
            </p>
          </div>
          <span
            :class="[
              'text-xs px-2 py-0.5 rounded-full font-medium',
              selectedUser.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            ]"
          >
            {{ selectedUser.role }}
          </span>
        </div>

        <!-- Info rows -->
        <div class="space-y-3">
          <div>
            <p class="text-xs text-muted-foreground">
              Member since
            </p>
            <p class="text-sm mt-0.5">
              {{ formatDate(selectedUser.createdAt) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">
              Last login
            </p>
            <p
              v-if="detailLoading"
              class="text-sm mt-0.5 text-muted-foreground"
            >
              Loading...
            </p>
            <p
              v-else-if="selectedUser.lastLoginAt"
              class="text-sm mt-0.5"
            >
              {{ formatDateTime(selectedUser.lastLoginAt) }}
            </p>
            <p
              v-else
              class="text-sm mt-0.5 text-muted-foreground"
            >
              Never
            </p>
          </div>
        </div>

        <!-- Recovery link — only for non-admin, non-self accounts -->
        <div
          v-if="selectedUser.role !== 'admin' && selectedUser.id !== auth.user?.id"
          class="border-t border-border pt-4 space-y-2"
        >
          <p class="text-xs text-muted-foreground">
            Recovery link
          </p>
          <p class="text-xs text-muted-foreground/70 leading-relaxed">
            One-time link that bypasses password. Expires in 24h.
          </p>

          <div
            v-if="recoveryUrl"
            class="space-y-2"
          >
            <div class="font-mono text-[10px] bg-muted px-2 py-1.5 rounded-lg break-all text-muted-foreground leading-relaxed">
              {{ recoveryUrl }}
            </div>
            <button
              class="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              :class="copiedRecovery ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary hover:bg-primary/20'"
              @click="copyRecoveryLink"
            >
              <Check
                v-if="copiedRecovery"
                class="size-3"
                :stroke-width="2"
              />
              <Copy
                v-else
                class="size-3"
                :stroke-width="1.75"
              />
              {{ copiedRecovery ? 'Copied!' : 'Copy link' }}
            </button>
            <button
              class="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
              :disabled="generatingRecovery"
              @click="generateRecoveryLink"
            >
              <RefreshCw
                class="size-3"
                :class="generatingRecovery ? 'animate-spin' : ''"
                :stroke-width="1.75"
              />
              Regenerate
            </button>
          </div>
          <button
            v-else
            class="w-full py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            :disabled="generatingRecovery"
            @click="generateRecoveryLink"
          >
            {{ generatingRecovery ? 'Generating...' : 'Generate recovery link' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
