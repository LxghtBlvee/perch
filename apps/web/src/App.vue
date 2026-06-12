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

// Handle OAuth token redirect: /?token=xxx
const urlParams = new URLSearchParams(location.search)
const oauthToken = urlParams.get('token')
if (oauthToken) {
  auth.setToken(oauthToken)
  history.replaceState({}, '', location.pathname + location.hash)
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