<script setup lang="ts">
import { currentAccount } from '~/game/account'
const offline=ref(false)
const ready=ref(false),checking=ref(true)
onMounted(async()=>{offline.value=!navigator.onLine;if(offline.value){checking.value=false;return}try{await $fetch('/api/arena',{timeout:5000});ready.value=Boolean(await currentAccount())}catch{offline.value=true}finally{checking.value=false}})
</script>
<template><div v-if="offline" class="p-12 text-white"><h1>Online needs internet.</h1><p>Campaign can run on this device.</p><NuxtLink to="/">Return to menu</NuxtLink></div><div v-else-if="checking" class="p-12 text-white">Checking your account…</div><TrainingArena v-else-if="ready" mode="online" /><AccountGate v-else @signed-in="ready=true" @close="navigateTo('/')" /></template>
