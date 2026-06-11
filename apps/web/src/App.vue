<script setup lang="ts">
import Sidebar from '@/components/layout/Sidebar.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { usePerchSocket } from '@/composables/usePerchSocket'
import { useAuthStore } from '@/stores/auth'
import { useRoute, useRouter } from 'vue-router'
import { computed, onMounted } from 'vue'
import { useColorMode } from '@/composables/useColorMode'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

// Color mode is initialized by the composable import
useColorMode()

const isPublicRoute = computed(() => route.meta.public === true)

// Handle OAuth token redirect: /?token=xxx
const urlParams = new URLSearchParams(location.search)
const oauthToken = urlParams.get('token')
if (oauthToken) {
  auth.setToken(oauthToken)
  history.replaceState({}, '', location.pathname + location.hash)
}

usePerchSocket()

// Custom domain detection: if this hostname has a status page, route to it
onMounted(async () => {
  if (window.location.pathname !== '/') return
  try {
    const res = await fetch('/api/status-by-domain')
    if (res.ok) {
      const { slug } = await res.json() as { slug: string }
      router.replace(`/status/${slug}`)
    }
  } catch { /* not a custom domain */ }
})
</script>

<template>
  <div class="flex h-screen bg-background text-foreground overflow-hidden">
    <Sidebar v-if="!isPublicRoute" />
    <main class="flex-1 overflow-y-auto">
      <RouterView />
    </main>
    <ToastContainer />
    <ConfirmDialog />
  </div>
</template>