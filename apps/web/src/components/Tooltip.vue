<script setup lang="ts">
withDefaults(defineProps<{
  text: string
  side?: 'top' | 'bottom'
}>(), {
  side: 'top',
})
</script>

<template>
  <div class="relative inline-flex group/tt">
    <slot />
    <div
      :class="[
        'pointer-events-none absolute left-1/2 -translate-x-1/2 z-50',
        'px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap',
        'bg-popover border border-border text-popover-foreground shadow-md',
        'opacity-0 group-hover/tt:opacity-100 transition-opacity duration-150',
        side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
      ]"
    >
      {{ text }}
    </div>
  </div>
</template>
