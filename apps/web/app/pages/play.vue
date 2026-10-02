<script setup lang="ts">
const route = useRoute()
const mode = computed(() => route.query.mode === 'online' ? 'online' : route.query.mode === 'solo' ? 'solo' : 'training')
</script>
<template>
  <main class="relative h-dvh overflow-hidden"><ClientOnly><TrainingArena :key="route.fullPath" :mode="mode" /><template #fallback><div class="p-12">Preparing the arena…</div></template></ClientOnly></main>
</template>
