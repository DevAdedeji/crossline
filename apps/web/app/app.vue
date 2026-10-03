<script setup lang="ts">
const hostname = useRequestURL().hostname

if (!import.meta.dev && hostname === 'crossline.adedeji.xyz') {
  useHead({
    script: [
      {
        src: 'https://www.sabilytics.com/script.js',
        async: true,
        'data-site': 'mua4r0wm78h6',
        'data-domain': 'crossline.adedeji.xyz',
      },
    ],
  })
}
</script>

<template><UApp><NuxtPwaManifest /><NuxtPage /><PwaControls /></UApp></template>
