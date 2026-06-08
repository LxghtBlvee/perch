<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="text-center space-y-4 max-w-sm px-6">
      <p class="text-7xl font-bold text-primary/20 select-none">
        403
      </p>
      <div>
        <h1 class="text-xl font-semibold tracking-tight">
          Access denied
        </h1>
        <p class="text-sm text-muted-foreground mt-1">
          You don't have permission to view this page.
        </p>
      </div>
      <button
        class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        @click="router.push('/')"
      >
        Back to overview
      </button>
    </div>
  </div>
</template>
