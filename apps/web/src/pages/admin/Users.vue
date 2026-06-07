<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Trash2, ShieldCheck, ShieldMinus } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import type { ManagedUser } from '@perch/types'

const auth = useAuthStore()
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

async function toggleRole(user: ManagedUser) {
  const newRole = user.role === 'admin' ? 'member' : 'admin'
  await fetch(`/api/users/${user.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify({ role: newRole }),
  })
  await fetchUsers()
}

async function deleteUser(user: ManagedUser) {
  if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return
  await fetch(`/api/users/${user.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  await fetchUsers()
}

async function createUser() {
  createError.value = ''
  creating.value = true
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="p-6 space-y-6 max-w-3xl">
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

    <!-- Users table -->
    <div class="rounded-xl border border-border bg-card divide-y divide-border">
      <div
        v-if="loading"
        class="p-8 text-center text-sm text-muted-foreground"
      >
        Loading...
      </div>
      <div
        v-for="user in users"
        :key="user.id"
        class="flex items-center gap-4 p-4"
      >
        <!-- Avatar placeholder -->
        <div class="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
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
  </div>
</template>