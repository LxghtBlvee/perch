<!-- apps/web/src/pages/NotFound.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
    <div class="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" role="img" aria-label="Perch" class="h-10 w-10">
        <line x1="2" y1="80" x2="98" y2="80" stroke="#7dd3c0" stroke-width="1.8" stroke-linecap="round"/>
        <path fill="#7dd3c0" fill-rule="evenodd" d="M 22 58 C 14 50 16 38 26 34 C 30 24 46 20 58 24 C 64 18 76 20 78 28 C 80 30 82 33 82 36 L 92 38 L 94 40 L 84 43 C 82 48 76 52 68 54 C 64 60 56 62 48 62 L 30 62 L 12 60 L 22 58 Z M 70 30.5 a 1.5 1.5 0 1 0 0 3 a 1.5 1.5 0 1 0 0 -3 Z"/>
        <line x1="40" y1="62" x2="40" y2="80" stroke="#7dd3c0" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="52" y1="62" x2="52" y2="80" stroke="#7dd3c0" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </div>
    <div>
      <h1 class="text-3xl font-semibold tracking-tight">404</h1>
      <p class="mt-1 text-sm text-muted-foreground">This page flew the coop — there's nothing here.</p>
    </div>
    <button
      class="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      @click="router.push('/')"
    >
      Back to overview
    </button>
  </div>
</template>
