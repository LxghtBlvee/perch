<script setup lang="ts">
import Sidebar from '@/components/layout/Sidebar.vue'
import { usePerchSocket } from '@/composables/usePerchSocket'
import { useAuthStore } from '@/stores/auth'
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import { useColorMode } from '@/composables/useColorMode'

const auth = useAuthStore()
const route = useRoute()

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
</script>

<template>
  <div class="flex h-screen bg-background text-foreground overflow-hidden">
    <Sidebar v-if="!isPublicRoute" />
    <main class="flex-1 overflow-y-auto">
      <RouterView />
    </main>
  </div>
</template>