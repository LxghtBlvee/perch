<script setup lang="ts">
import Sidebar from '@/components/layout/Sidebar.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import OnboardingModal from '@/components/OnboardingModal.vue'
import StatusPage from '@/pages/StatusPage.vue'
import { usePerchSocket } from '@/composables/usePerchSocket'
import { useAuthStore } from '@/stores/auth'
import { useRoute } from 'vue-router'
import { computed, onMounted, ref } from 'vue'
import { useColorMode } from '@/composables/useColorMode'

const auth = useAuthStore()
const route = useRoute()

// Color mode is initialized by the composable import
useColorMode()

const isPublicRoute = computed(() => route.meta.public === true)
const customDomainSlug = ref<string | null>(null)

// Handle OAuth/recovery handoff redirect: /?code=xxx
// The server never puts the real session token in the URL — it issues a 30-second
// single-use code instead. We exchange it here via POST, which keeps the token
// out of server logs, Referer headers, and browser history.
const urlParams = new URLSearchParams(location.search)
const handoffCode = urlParams.get('code')
if (handoffCode) {
  // Strip the code from the URL immediately so it doesn't linger in history
  history.replaceState({}, '', location.pathname + location.hash)
  fetch('/api/auth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: handoffCode }),
  }).then(async (res) => {
    if (res.ok) {
      const { token } = await res.json() as { token: string }
      auth.setToken(token)
    }
  }).catch(() => { /* code expired or network error — user stays logged out */ })
}

usePerchSocket()

// Custom domain detection: render status page at / without changing the URL
onMounted(async () => {
  try {
    const res = await fetch('/api/status-by-domain')
    if (res.ok) {
      const { slug } = await res.json() as { slug: string }
      customDomainSlug.value = slug
    }
  } catch { /* not a custom domain */ }
})
</script>

<template>
  <div class="flex h-screen bg-background text-foreground overflow-hidden">
    <!-- Custom domain: render status page at / keeping the URL clean -->
    <template v-if="customDomainSlug">
      <main class="flex-1 overflow-y-auto">
        <StatusPage :forced-slug="customDomainSlug" />
      </main>
    </template>
    <template v-else>
      <Sidebar v-if="!isPublicRoute" />
      <main class="flex-1 overflow-y-auto">
        <RouterView />
      </main>
    </template>
    <ToastContainer />
    <ConfirmDialog />
    <OnboardingModal />
  </div>
</template>