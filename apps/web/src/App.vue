<script setup lang="ts">
import Sidebar from '@/components/layout/Sidebar.vue'
import { usePerchSocket } from '@/composables/usePerchSocket'
import { useAuthStore } from '@/stores/auth'
import { useRoute } from 'vue-router'
import { onMounted, onUnmounted, computed } from 'vue'

const auth = useAuthStore()
const route = useRoute()

const isPublicRoute = computed(() => route.meta.public === true)

// Handle OAuth token redirect: /?token=xxx
const urlParams = new URLSearchParams(location.search)
const oauthToken = urlParams.get('token')
if (oauthToken) {
  auth.setToken(oauthToken)
  // Clean the token from the URL
  const clean = location.pathname + location.hash
  history.replaceState({}, '', clean)
}

usePerchSocket()

// System color mode
function applyColorMode() {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

const mq = window.matchMedia('(prefers-color-scheme: dark)')
onMounted(() => {
  applyColorMode()
  mq.addEventListener('change', applyColorMode)
})
onUnmounted(() => mq.removeEventListener('change', applyColorMode))
</script>

<template>
  <div class="flex h-screen bg-background text-foreground overflow-hidden">
    <Sidebar v-if="!isPublicRoute" />
    <main class="flex-1 overflow-y-auto">
      <RouterView />
    </main>
  </div>
</template>