<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Globe, Lock, Trash2, Copy, Check, ExternalLink } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()

interface StatusPageItem {
  id: string
  slug: string
  name: string
  isPublic: boolean
  checkCount: number
  createdAt: string
  updatedAt: string
}

const pages = ref<StatusPageItem[]>([])
const loading = ref(true)
const showCreate = ref(false)
const creating = ref(false)
const newName = ref('')
const newSlug = ref('')
const newIsPublic = ref(true)
const copiedId = ref<string | null>(null)
const deletingId = ref<string | null>(null)
const createError = ref('')

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
  try {
    const res = await fetch('/api/admin/status-pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ name: newName.value, slug: newSlug.value, isPublic: newIsPublic.value }),
    })
    creating.value = false
    if (res.ok) {
      const page = await res.json() as StatusPageItem
      showCreate.value = false
      createError.value = ''
      newName.value = ''
      newSlug.value = ''
      newIsPublic.value = true
      router.push(`/admin/status-pages/${page.id}`)
    } else {
      const text = await res.text()
      let msg = 'Failed to create status page'
      try { msg = (JSON.parse(text) as { error?: string }).error ?? msg } catch { /* ignore invalid JSON */ }
      createError.value = msg
      toast.error(msg)
    }
  } catch {
    creating.value = false
    createError.value = 'Network error — please try again'
    toast.error('Network error — please try again')
  }
}

async function deletePage(id: string, name: string) {
  const ok = await confirm({ title: `Delete "${name}"?`, message: 'This cannot be undone. All checks and incidents on this page will be removed.', confirmLabel: 'Delete', danger: true })
  if (!ok) return
  deletingId.value = id
  const res = await fetch(`/api/admin/status-pages/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  deletingId.value = null
  if (res.ok) {
    pages.value = pages.value.filter(p => p.id !== id)
    toast.success('Status page deleted')
  } else {
    toast.error('Failed to delete status page')
  }
}

function copyLink(slug: string, id: string) {
  navigator.clipboard.writeText(`${location.origin}/status/${slug}`)
  copiedId.value = id
  toast.success('Link copied to clipboard')
  setTimeout(() => { copiedId.value = null }, 2000)
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50'
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          Status Pages
        </h1>
        <p class="text-sm text-muted-foreground mt-1">
          Share uptime status with your users via a public or private page.
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
      class="rounded-xl border border-dashed border-border p-12 text-center"
    >
      <Globe
        class="size-8 text-muted-foreground mx-auto mb-3"
        :stroke-width="1.25"
      />
      <p class="text-sm font-medium">
        No status pages yet
      </p>
      <p class="text-xs text-muted-foreground mt-1 mb-4">
        Create one to share uptime with your users.
      </p>
      <button
        class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        @click="showCreate = true"
      >
        Create your first page
      </button>
    </div>

    <!-- Table -->
    <div
      v-else
      class="rounded-xl border border-border overflow-hidden"
    >
      <div class="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground">
        <span>Page</span>
        <span class="w-20 text-center">Visibility</span>
        <span class="w-14 text-center">Checks</span>
        <span class="w-24 text-right">Actions</span>
      </div>

      <div class="divide-y divide-border">
        <div
          v-for="page in pages"
          :key="page.id"
          class="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-4 hover:bg-accent/50 transition-colors cursor-pointer group"
          @click="router.push(`/admin/status-pages/${page.id}`)"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium group-hover:text-primary transition-colors truncate">
              {{ page.name }}
            </p>
            <p class="text-xs text-muted-foreground font-mono mt-0.5">
              /status/{{ page.slug }}
            </p>
          </div>

          <div class="w-20 flex justify-center">
            <span
              :class="[
                'flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full',
                page.isPublic ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
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

          <div class="w-14 text-center">
            <span class="text-xs text-muted-foreground">{{ page.checkCount }}</span>
          </div>

          <div
            class="w-24 flex items-center justify-end gap-1"
            @click.stop
          >
            <a
              :href="`/status/${page.slug}`"
              target="_blank"
              class="size-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
              title="Open"
            >
              <ExternalLink
                class="size-3.5 text-muted-foreground"
                :stroke-width="1.75"
              />
            </a>
            <button
              class="size-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
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
              class="size-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-50"
              title="Delete"
              :disabled="deletingId === page.id"
              @click="deletePage(page.id, page.name)"
            >
              <Trash2
                class="size-3.5 text-muted-foreground"
                :stroke-width="1.75"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Create modal -->
  <Teleport to="body">
    <div
      v-if="showCreate"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        class="absolute inset-0 bg-black/50"
        @click="showCreate = false; createError = ''"
      />
      <div class="relative z-10 bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
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
              @keydown.enter="createPage"
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
                @keydown.enter="createPage"
              >
            </div>
          </div>
          <div class="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5">
            <div>
              <p class="text-sm">
                Public
              </p>
              <p class="text-xs text-muted-foreground">
                Anyone with the link can view.
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
          class="text-xs text-red-500 -mt-1"
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
</template>
