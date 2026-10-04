<script setup lang="ts">
import { selectController, controllerButtons } from '~/game/controller'
import { prepareEntry } from '~/game/entry'
import { EXTRACTION_MISSION as mission, CAMPAIGN_OBJECTIVES } from '@crossline/shared/campaign'
import { readCampaignProgress, saveCampaignProgress } from '~/game/campaignProgress'
const progress = ref<ReturnType<typeof readCampaignProgress>>()
const launching = ref(false)
onMounted(() => { progress.value = readCampaignProgress() })
async function deploy(restart = false, usePad = false) {
  if (launching.value) return
  launching.value = true
  if (restart && progress.value) saveCampaignProgress({ ...progress.value, checkpoint: 'relay', cleared: [], elapsedMs: 0 })
  if (usePad) await prepareEntry('pad')
  await navigateTo('/play?mode=campaign')
}
let frame = 0, armed = false, wasConfirm = false, wasBack = false
function pollController() {
  const pad = selectController(Array.from(navigator.getGamepads?.() ?? []))
  if (pad && document.hasFocus() && !document.hidden) {
    const buttons = controllerButtons(pad), confirm = Boolean(buttons[0]), back = Boolean(buttons[1])
    if (!confirm) armed = true
    if (armed && confirm && !wasConfirm && progress.value) void deploy(false, true)
    if (back && !wasBack) void navigateTo('/')
    wasConfirm = confirm; wasBack = back
  }
  frame = requestAnimationFrame(pollController)
}
onMounted(() => { frame = requestAnimationFrame(pollController) })
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>
<template>
  <main class="campaign-briefing">
    <header><NuxtLink to="/" class="brand">CROSSLINE<span>+</span></NuxtLink><NuxtLink to="/">← Back to modes</NuxtLink></header>
    <section>
      <div class="brief-copy">
        <p class="eyebrow">CAMPAIGN / {{ mission.operation }}</p>
        <h1>{{ mission.title }}.</h1>
        <p class="brief-text">{{ mission.briefing }}</p>
        <div class="brief-meta"><span>01 / EXTRACTION</span><span>HARBOUR RELAY / 168 × 168 M</span><span>1 PLAYER</span></div>
        <ol aria-label="Mission objectives"><li v-for="(objective, index) in Object.values(CAMPAIGN_OBJECTIVES)" :key="objective.title"><span>0{{ index + 1 }}</span><div><strong>{{ objective.title }}</strong><p>{{ objective.instruction }}</p></div></li></ol>
        <p v-if="progress?.completed" class="completion">✓ Mission completed <span v-if="progress.bestTimeMs">· Best {{ Math.floor(progress.bestTimeMs / 60000) }}:{{ String(Math.floor(progress.bestTimeMs / 1000) % 60).padStart(2, '0') }}</span></p>
        <p v-if="progress && progress.checkpoint !== 'relay'" class="checkpoint">Checkpoint available · {{ CAMPAIGN_OBJECTIVES[progress.checkpoint].title }}</p>
        <button class="deploy" :disabled="launching || !progress" @click="deploy()">{{ launching ? 'Preparing operation…' : progress?.checkpoint !== 'relay' ? 'Continue mission' : progress?.completed ? 'Replay mission' : 'Begin mission' }} <span aria-hidden="true">↗</span></button>
        <button v-if="progress && progress.checkpoint !== 'relay'" class="restart" :disabled="launching" @click="deploy(true)">Restart from insertion</button>
        <p class="save-note">Checkpoints save on this device. Eliminated guards stay down. Reach extraction with Finch to complete the mission.</p>
      </div>
      <aside class="operation-map" aria-label="Harbour Relay mission map">
        <div class="map-caption"><span>FIELD INTELLIGENCE</span><span>N ↑</span></div>
        <svg viewBox="0 0 360 400" role="img" aria-label="Route from the south insertion to the north relay, east office and southwest extraction">
          <defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#ffffff0d" /></pattern></defs>
          <rect width="360" height="400" fill="url(#grid)" />
          <path d="M180 375V25M20 205H340M40 340H320" stroke="#ffffff14" stroke-width="16" />
          <path d="M178 354V98H290V210L68 335" fill="none" stroke="#efb36b" stroke-width="2" stroke-dasharray="6 6" />
          <g fill="#384b51" stroke="#82978f"><rect x="70" y="132" width="68" height="50"/><rect x="219" y="137" width="68" height="50"/><rect x="62" y="235" width="68" height="50"/><rect x="271" y="62" width="59" height="50"/></g>
          <g fill="#efb36b"><circle cx="180" cy="98" r="6"/><circle cx="290" cy="91" r="6"/><circle cx="68" cy="335" r="6"/><path d="M178 342L186 360H170Z"/></g>
          <g fill="#e7e7dd" font-family="Arial" font-size="10"><text x="137" y="76">01 / RELAY</text><text x="264" y="48">02 / FINCH</text><text x="42" y="366">03 / EXTRACTION</text><text x="196" y="365">INSERTION</text></g>
        </svg>
        <p>CONTROL / 06:40</p><blockquote>“Get in. Find Finch.<br />Bring them home.”</blockquote>
      </aside>
    </section>
  </main>
</template>
<style scoped>
.campaign-briefing{min-height:100dvh;background:radial-gradient(ellipse at 80% 20%,#263a3b,#10171c 65%);color:#edf1ef;font-family:Arial,sans-serif}.campaign-briefing header{display:flex;justify-content:space-between;align-items:center;padding:24px 5vw;border-bottom:1px solid #ffffff1c;font-size:12px}.brand{font-size:26px;font-weight:900;letter-spacing:-1.5px}.brand span{color:#ffb15c}.campaign-briefing section{max-width:1180px;margin:auto;padding:56px 5vw;display:grid;grid-template-columns:1.3fr 1fr;gap:70px}.eyebrow{color:#efb36b;font-size:11px;letter-spacing:.16em;text-transform:uppercase}h1{font-size:clamp(40px,6vw,76px);line-height:1.04;font-weight:800;letter-spacing:-.05em;margin:16px 0 24px}.brief-text{font-size:15px;line-height:1.8;color:#b5c1c7}.brief-meta{display:flex;flex-wrap:wrap;gap:16px;margin:24px 0;font-size:10px;letter-spacing:.06em;color:#efb36b}ol{list-style:none;border-block:1px solid #ffffff1c;margin:20px 0;padding:10px 0}li{display:flex;gap:18px;padding:14px 0}li>span{color:#efb36b;font-size:11px;padding-top:3px}li strong{font-size:14px}li p{font-size:12px;color:#a5b4bc;line-height:1.6;margin:5px 0 0}.deploy{display:flex;align-items:center;justify-content:space-between;background:#efb36b;color:#141a1f;width:100%;min-height:52px;padding:14px 20px;font-weight:700;border-radius:4px;margin-top:22px}.deploy:disabled{opacity:.5}.deploy:focus-visible,.restart:focus-visible{outline:2px solid white;outline-offset:4px}.restart{padding:14px 0;font-size:12px;text-decoration:underline}.save-note{font-size:11px;line-height:1.7;color:#90a0a9;margin-top:18px}.completion,.checkpoint{color:#b8d9b0;font-size:12px;margin-top:12px}.operation-map{align-self:start;background:#152328;border:1px solid #ffffff20;padding:22px;box-shadow:0 24px 60px #0004}.map-caption{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.12em;color:#aebdb9}.operation-map svg{width:100%;margin-top:16px}.operation-map>p{color:#efb36b;font-size:10px;margin:20px 0 12px}.operation-map blockquote{font-size:23px;line-height:1.4;font-weight:700}@media(max-width:760px){.campaign-briefing section{grid-template-columns:1fr;gap:30px;padding-top:30px}.operation-map{display:none}.campaign-briefing header{padding:18px 5vw}h1{font-size:46px}}@media(max-height:500px){.campaign-briefing section{padding-top:24px}.operation-map{display:none}.campaign-briefing section{grid-template-columns:1fr;max-width:780px}h1{font-size:36px}}
</style>
