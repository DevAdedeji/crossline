<script setup lang="ts">
import { currentAccount } from '~/game/account'
const ready=ref(false),checking=ref(true)
onMounted(async()=>{try{ready.value=Boolean(await currentAccount())}finally{checking.value=false}})
</script>
<template><div v-if="checking" class="p-12 text-white">Checking your account…</div><TrainingArena v-else-if="ready" mode="online" /><AccountGate v-else @signed-in="ready=true" @close="navigateTo('/')" /></template>
