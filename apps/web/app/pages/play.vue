<script setup lang="ts">
const route = useRoute()
const mode = computed(() => route.query.mode === 'campaign' ? 'campaign' : route.query.mode === 'online' ? 'online' : route.query.mode === 'solo' ? 'solo' : 'training')
</script>
<template>
  <main class="relative overflow-hidden"><ClientOnly><OnlineEntry v-if="mode==='online'" :key="route.fullPath" /><TrainingArena v-else :key="route.fullPath" :mode="mode" :mission-id="typeof route.query.mission === 'string' ? route.query.mission : undefined" /><template #fallback><div class="p-12">Preparing the arena…</div></template></ClientOnly></main>
</template>
