<script setup lang="ts">
import Sidebar from '@/components/layout/Sidebar.vue'
import { usePerchSocket } from '@/composables/usePerchSocket'
import { onMounted, onUnmounted } from 'vue'

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
    <Sidebar />
    <main class="flex-1 overflow-y-auto">
      <RouterView />
    </main>
  </div>
</template>