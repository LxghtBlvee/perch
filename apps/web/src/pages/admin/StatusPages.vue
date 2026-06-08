<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Globe, Lock, Pencil, Trash2, Copy, Check } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

interface StatusPageItem {
  id: string
  slug: string
  name: string
  isPublic: boolean
  checkCount: number
  createdAt: string
}

const pages = ref<StatusPageItem[]>([])
const loading = ref(true)
const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const newName = ref('')
const newSlug = ref('')
const newIsPublic = ref(true)
const copiedId = ref<string | null>(null)

onMounted(fetchPages)

async function fetchPages() {
  loading.value = true
  const res = await fetch('/api/admin/status-pages', {
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  if (res.ok) pages.value = await res.json() as StatusPageItem[]
  loading.value = false
}

function autoSlug() {
  newSlug.value = newName.value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function createPage() {
  if (!newName.value || !newSlug.value) return
  creating.value = true
  createError.value = ''
  const res = await fetch('/api/admin/status-pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ name: newName.value, slug: newSlug.value, isPublic: newIsPublic.value }),
  })
  creating.value = false
  if (res.ok) {
    const page = await res.json() as StatusPageItem
    showCreate.value = false
    newName.value = ''
    newSlug.value = ''
    newIsPublic.value = true
    router.push(`/admin/status-pages/${page.id}`)
  } else {
    const data = await res.json() as { error?: string }
    createError.value = data.error ?? 'Failed to create'
  }
}

async function deletePage(id: string) {
  if (!confirm('Delete this status page?')) return
  await fetch(`/api/admin/status-pages/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  pages.value = pages.value.filter(p => p.id !== id)
}

function copyLink(slug: string, id: string) {
  navigator.clipboard.writeText(`${location.origin}/status/${slug}`)
  copiedId.value = id
  setTimeout(() => { copiedId.value = null }, 2000)
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50'
</script>

<template>
  <div class="p-6 space-y-6 max-w-4xl">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          Status Pages
        </h1>
        <p class="text-sm text-muted-foreground mt-1">
          Create public or private status pages for your health checks.
        </p>
      </div>
      <button
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        @click="showCreate = true"
      >
        <Plus
          class="size-4"
          :stroke-width="1.75"
        />
        New page
      </button>
    </div>

    <div
      v-if="loading"
      class="text-sm text-muted-foreground"
    >
      Loading...
    </div>

    <div
      v-else-if="pages.length === 0"
      class="rounded-xl border border-border bg-card p-10 text-center"
    >
      <Globe
        class="size-8 text-muted-foreground mx-auto mb-3"
        :stroke-width="1.5"
      />
      <p class="text-sm font-medium">
        No status pages yet
      </p>
      <p class="text-xs text-muted-foreground mt-1">
        Create one to share uptime with your users.
      </p>
    </div>

    <div
      v-else
      class="space-y-3"
    >
      <div
        v-for="page in pages"
        :key="page.id"
        class="rounded-xl border border-border bg-card p-5 flex items-center gap-4"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-sm font-medium">
              {{ page.name }}
            </p>
            <span
              :class="[
                'flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                page.isPublic
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-muted text-muted-foreground'
              ]"
            >
              <Globe
                v-if="page.isPublic"
                class="size-2.5"
              />
              <Lock
                v-else
                class="size-2.5"
              />
              {{ page.isPublic ? 'Public' : 'Private' }}
            </span>
          </div>
          <div class="flex items-center gap-3 mt-1">
            <span class="text-xs text-muted-foreground font-mono">/status/{{ page.slug }}</span>
            <span class="text-xs text-muted-foreground">·</span>
            <span class="text-xs text-muted-foreground">{{ page.checkCount }} check{{ page.checkCount === 1 ? '' : 's' }}</span>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            class="size-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors"
            title="Copy link"
            @click="copyLink(page.slug, page.id)"
          >
            <Check
              v-if="copiedId === page.id"
              class="size-3.5 text-green-500"
              :stroke-width="2"
            />
            <Copy
              v-else
              class="size-3.5 text-muted-foreground"
              :stroke-width="1.75"
            />
          </button>
          <button
            class="size-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors"
            title="Edit"
            @click="router.push(`/admin/status-pages/${page.id}`)"
          >
            <Pencil
              class="size-3.5 text-muted-foreground"
              :stroke-width="1.75"
            />
          </button>
          <button
            class="size-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors"
            title="Delete"
            @click="deletePage(page.id)"
          >
            <Trash2
              class="size-3.5 text-muted-foreground"
              :stroke-width="1.75"
            />
          </button>
        </div>
      </div>
    </div>

    <!-- Create modal -->
    <Teleport to="body">
      <div
        v-if="showCreate"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      >
        <div class="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
          <h2 class="text-base font-semibold">
            New status page
          </h2>

          <div class="space-y-3">
            <div class="space-y-1">
              <label class="text-xs text-muted-foreground">Name</label>
              <input
                v-model="newName"
                type="text"
                placeholder="My Services"
                :class="INPUT"
                @input="autoSlug"
              >
            </div>
            <div class="space-y-1">
              <label class="text-xs text-muted-foreground">Slug</label>
              <div class="flex items-center gap-2">
                <span class="text-xs text-muted-foreground shrink-0">/status/</span>
                <input
                  v-model="newSlug"
                  type="text"
                  placeholder="my-services"
                  :class="INPUT"
                >
              </div>
            </div>
            <div class="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5">
              <div>
                <p class="text-sm">
                  Public
                </p>
                <p class="text-xs text-muted-foreground">
                  Anyone with the link can view this page.
                </p>
              </div>
              <button
                class="relative shrink-0 w-9 h-5 rounded-full transition-colors"
                :class="newIsPublic ? 'bg-primary' : 'bg-muted'"
                @click="newIsPublic = !newIsPublic"
              >
                <div :class="['absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform', newIsPublic ? 'translate-x-4' : 'translate-x-0.5']" />
              </button>
            </div>
          </div>

          <p
            v-if="createError"
            class="text-xs text-red-500"
          >
            {{ createError }}
          </p>

          <div class="flex gap-2 pt-1">
            <button
              class="flex-1 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
              @click="showCreate = false; createError = ''"
            >
              Cancel
            </button>
            <button
              :disabled="!newName || !newSlug || creating"
              class="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              @click="createPage"
            >
              {{ creating ? 'Creating...' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>