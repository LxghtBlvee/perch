<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useColorMode } from '@/composables/useColorMode'

const auth = useAuthStore()
const { isDark } = useColorMode()

const show = ref(false)
const selected = ref<Set<string>>(new Set())
const saving = ref(false)

interface Platform {
  id: string
  name: string
  description: string
  lightIcon: string
  darkIcon: string
  available: boolean
}

const PLATFORMS: Platform[] = [
  {
    id: 'docker',
    name: 'Docker',
    description: 'Containers and hosts running Docker Engine',
    lightIcon: '/icons/integrations/docker.svg',
    darkIcon: '/icons/integrations/docker.svg',
    available: true,
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    description: 'Clusters, pods, and deployments',
    lightIcon: '/icons/integrations/kubernetes.svg',
    darkIcon: '/icons/integrations/kubernetes.svg',
    available: false,
  },
  {
    id: 'podman',
    name: 'Podman',
    description: 'Rootless OCI container management',
    lightIcon: '/icons/integrations/podman.svg',
    darkIcon: '/icons/integrations/podman.svg',
    available: false,
  },
  {
    id: 'proxmox',
    name: 'Proxmox',
    description: 'VMs and LXC containers on Proxmox nodes',
    lightIcon: '/icons/integrations/proxmox-light.svg',
    darkIcon: '/icons/integrations/proxmox-dark.svg',
    available: false,
  },
  {
    id: 'nomad',
    name: 'Nomad',
    description: 'HashiCorp Nomad workload orchestration',
    lightIcon: '/icons/integrations/nomad.svg',
    darkIcon: '/icons/integrations/nomad.svg',
    available: false,
  },
  {
    id: 'lxc',
    name: 'LXC / LXD',
    description: 'Linux system containers via LXC or LXD',
    lightIcon: '/icons/integrations/lxc.svg',
    darkIcon: '/icons/integrations/lxc.svg',
    available: false,
  },
]

function iconFor(p: Platform) {
  return isDark.value ? p.darkIcon : p.lightIcon
}

function toggle(id: string) {
  if (selected.value.has(id)) {
    selected.value.delete(id)
  } else {
    selected.value.add(id)
  }
}

watch(() => auth.token, async (token) => {
  if (!token || show.value) return
  try {
    const res = await fetch('/api/admin/instance-settings/onboarding', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const data = await res.json() as {
      completed: boolean
      enabledPlatforms: string[]
      detectedPlatforms: string[]
    }
    if (data.completed) return

    // Pre-select detected platforms, plus any already saved
    selected.value = new Set([...data.detectedPlatforms, ...data.enabledPlatforms])
    show.value = true
  } catch { /* ignore */ }
}, { immediate: true })

async function complete() {
  if (saving.value) return
  saving.value = true
  try {
    await fetch('/api/admin/instance-settings/onboarding/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ platforms: [...selected.value] }),
    })
    show.value = false
  } catch { /* ignore */ } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-200"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <div class="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
          <!-- Header -->
          <div class="px-8 pt-8 pb-6">
            <h1 class="text-2xl font-semibold tracking-tight">
              How will you use Perch?
            </h1>
            <p class="text-sm text-muted-foreground mt-1.5">
              Select the platforms you want to monitor. You can change this any time from the Instance page.
            </p>
          </div>

          <!-- Platform grid -->
          <div class="px-8 pb-6 grid grid-cols-2 gap-3">
            <button
              v-for="platform in PLATFORMS"
              :key="platform.id"
              class="relative flex items-center gap-4 rounded-xl border p-4 text-left transition-colors"
              :class="[
                selected.has(platform.id)
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:border-border/80 hover:bg-accent/40',
              ]"
              @click="toggle(platform.id)"
            >
              <!-- Logo -->
              <div class="size-10 shrink-0 flex items-center justify-center">
                <img
                  :src="iconFor(platform)"
                  :alt="platform.name"
                  class="size-8 object-contain"
                >
              </div>

              <!-- Text -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-medium leading-tight">
                    {{ platform.name }}
                  </p>
                  <span
                    v-if="!platform.available"
                    class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                  >
                    Coming soon
                  </span>
                </div>
                <p class="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {{ platform.description }}
                </p>
              </div>

              <!-- Checkmark -->
              <div
                class="size-4 rounded-full border shrink-0 flex items-center justify-center transition-colors"
                :class="selected.has(platform.id) ? 'border-primary bg-primary' : 'border-border'"
              >
                <svg
                  v-if="selected.has(platform.id)"
                  class="size-2.5 text-primary-foreground"
                  viewBox="0 0 10 10"
                  fill="none"
                >
                  <path
                    d="M1.5 5l2.5 2.5 4.5-4.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </button>
          </div>

          <!-- Footer -->
          <div class="px-8 py-5 border-t border-border flex items-center justify-between">
            <p class="text-xs text-muted-foreground">
              {{ selected.size }} platform{{ selected.size === 1 ? '' : 's' }} selected
            </p>
            <button
              :disabled="saving"
              class="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              @click="complete"
            >
              {{ saving ? 'Saving...' : 'Get started' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
