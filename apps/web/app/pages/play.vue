<script setup lang="ts">
const route = useRoute()
const mode = computed(() => route.query.mode === 'solo' ? 'solo' : 'training')
</script>
<template>
  <main class="relative h-dvh min-h-[500px] overflow-hidden"><ClientOnly><TrainingArena :key="mode" :mode="mode" /><template #fallback><div class="p-12">Preparing the arena…</div></template></ClientOnly></main>
</template>
