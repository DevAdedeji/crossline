<script setup lang="ts">
import { selectController, controllerButtons } from '~/game/controller'
import { prepareEntry } from '~/game/entry'
import { CAMPAIGN_MISSIONS, getMissionTasks, getCampaignMission } from '@crossline/shared/campaign'
import { readCampaignProgress, saveCampaignProgress } from '~/game/campaignProgress'
const route = useRoute()
const mission = computed(() => getCampaignMission(route.query.mission))
const tasks = computed(() => getMissionTasks(mission.value))
const act = ref(Math.floor((Number(mission.value.chapter)-1)/5))
const acts = ['Opening moves', 'Supply lines', 'Counteroffensive', 'Endgame']
const visibleMissions = computed(() => CAMPAIGN_MISSIONS.slice(act.value*5,act.value*5+5))
const progress = ref<ReturnType<typeof readCampaignProgress>>()
const launching = ref(false)
onMounted(() => { progress.value = readCampaignProgress(mission.value.id) })
watch(mission, value => { progress.value = readCampaignProgress(value.id); act.value = Math.floor((Number(value.chapter)-1)/5) })
async function deploy(restart = false, usePad = false) {
  if (launching.value) return
  launching.value = true
  if (restart && progress.value) saveCampaignProgress({ ...progress.value, checkpoint: 'relay', objectiveIndex: 0, cleared: [], elapsedMs: 0 })
  if (usePad) await prepareEntry('pad')
  await navigateTo(`/play?mode=campaign&mission=${mission.value.id}`)
}
let frame = 0, armed = false, wasConfirm = false, wasBack = false, wasDirection = 0
function pollController() {
  const pad = selectController(Array.from(navigator.getGamepads?.() ?? []))
  if (pad && document.hasFocus() && !document.hidden) {
    const buttons = controllerButtons(pad), confirm = Boolean(buttons[0]), back = Boolean(buttons[1])
    const direction = buttons[15] || (pad.axes[0] ?? 0) > .6 ? 1 : buttons[14] || (pad.axes[0] ?? 0) < -.6 ? -1 : 0
    if (direction && direction !== wasDirection && !launching.value) {
      const index = CAMPAIGN_MISSIONS.findIndex(item => item.id === mission.value.id)
      void navigateTo(`/campaign?mission=${CAMPAIGN_MISSIONS[(index+direction+CAMPAIGN_MISSIONS.length)%CAMPAIGN_MISSIONS.length]!.id}`)
    }
    wasDirection = direction
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
    <div class="campaign-navigation">
      <p>20 CHAPTERS <span>Progress saves separately for each mission</span></p>
      <div class="act-tabs" role="group" aria-label="Campaign acts"><button v-for="(name,index) in acts" :key="name" :aria-pressed="act === index" @click="act = index">{{ String(index+1).padStart(2,'0') }} / {{ name }}</button></div>
    </div>
    <nav class="mission-select" aria-label="Campaign missions">
      <NuxtLink v-for="item in visibleMissions" :key="item.id" :to="`/campaign?mission=${item.id}`" :aria-current="mission.id === item.id ? 'page' : undefined" :class="{ selected: mission.id === item.id }">
        <small>CHAPTER {{ item.chapter }} · {{ item.kind.toUpperCase() }}</small><strong>{{ item.title }}</strong><span>{{ item.world.name }}</span>
      </NuxtLink>
    </nav>
    <section>
      <div class="brief-copy">
        <p class="eyebrow">CAMPAIGN / {{ mission.operation }}</p>
        <h1>{{ mission.title }}.</h1>
        <p class="brief-text">{{ mission.briefing }}</p>
        <div class="brief-meta"><span>{{ mission.chapter }} / {{ mission.kind.toUpperCase() }}</span><span>{{ mission.world.name }} / {{ mission.world.limit * 2 }} × {{ mission.world.limit * 2 }} M</span><span>1 PLAYER</span></div>
        <ol aria-label="Mission objectives"><li v-for="(objective, index) in tasks" :key="objective.title"><span>{{ String(index + 1).padStart(2,'0') }}</span><div><strong>{{ objective.title }}</strong><p>{{ objective.instruction }}</p></div></li></ol>
        <p v-if="progress?.completed" class="completion">✓ Mission completed <span v-if="progress.bestTimeMs">· Best {{ Math.floor(progress.bestTimeMs / 60000) }}:{{ String(Math.floor(progress.bestTimeMs / 1000) % 60).padStart(2, '0') }}</span></p>
        <p v-if="progress && progress.checkpoint !== 'relay'" class="checkpoint">Checkpoint available · {{ mission.tasks ? tasks[progress.objectiveIndex ?? 0]?.title : mission.objectives[progress.checkpoint].title }}</p>
        <button class="deploy" :disabled="launching || !progress" @click="deploy()">{{ launching ? 'Preparing operation…' : progress?.checkpoint !== 'relay' ? 'Continue mission' : progress?.completed ? 'Replay mission' : 'Begin mission' }} <span aria-hidden="true">↗</span></button>
        <button v-if="progress && progress.checkpoint !== 'relay'" class="restart" :disabled="launching" @click="deploy(true)">Restart from insertion</button>
        <p class="save-note">Checkpoints save separately for each mission on this device. Eliminated guards stay down. Enemy grenades have a short fuse: leave the red circle or get behind solid cover. {{ mission.companion ? `Keep ${mission.companion} close through the exit.` : 'Complete every objective in order, then secure the exit.' }}</p>
      </div>
      <aside class="operation-map" :aria-label="`${mission.world.name} mission map`">
        <div class="map-caption"><span>{{ mission.world.name }}</span><span>N ↑</span></div>
        <svg :viewBox="`${-mission.world.limit-8} ${-mission.world.limit-8} ${mission.world.limit*2+16} ${mission.world.limit*2+16}`" role="img" aria-label="Mission route and arena layout">
          <g transform="scale(1 -1)">
            <rect :x="-mission.world.limit" :y="-mission.world.limit" :width="mission.world.limit*2" :height="mission.world.limit*2" fill="#182b30" stroke="#758c8244" />
            <g v-for="road in mission.world.roadCenters" :key="road" stroke="#ffffff0d" stroke-width="5"><path :d="`M${-mission.world.limit} ${road}H${mission.world.limit} M${road} ${-mission.world.limit}V${mission.world.limit}`" /></g>
            <rect v-for="building in mission.world.buildings" :key="building.id" :x="building.x-building.width/2" :y="building.z-building.depth/2" :width="building.width" :height="building.depth" fill="#506963" stroke="#a1b4a7" stroke-width=".4" />
            <polyline :points="[mission.spawn,...tasks.map(t=>t.position)].map(p=>`${p.x},${p.z}`).join(' ')" fill="none" stroke="#efb36b" stroke-width=".8" stroke-dasharray="3 3" />
            <circle v-for="(point,i) in tasks.map(t=>t.position)" :key="i" :cx="point.x" :cy="point.z" r="2.5" fill="#efb36b" />
            <circle :cx="mission.spawn.x" :cy="mission.spawn.z" r="2.5" fill="#9be4cd" />
          </g>
        </svg>
        <p>INSERTION → {{ tasks.length }} OBJECTIVES → EXTRACTION</p><blockquote>{{ mission.companion ? `Reach ${mission.companion}. Bring them home.` : 'Complete the objectives. Make it out.' }}</blockquote>
      </aside>
    </section>
  </main>
</template>
<style scoped>
.campaign-navigation{max-width:1180px;margin:24px auto 0;padding:0 5vw}.campaign-navigation>p{display:flex;justify-content:space-between;font-size:11px;letter-spacing:.06em;color:#efb36b;margin-bottom:14px}.campaign-navigation>p span{color:#a5b4bc;letter-spacing:0}.act-tabs{display:flex;gap:8px;overflow-x:auto}.act-tabs button{white-space:nowrap;padding:10px 13px;border:1px solid #ffffff25;border-radius:4px;font-size:11px;min-height:42px}.act-tabs button[aria-pressed=true]{background:#efb36b;color:#172026;border-color:#efb36b}.act-tabs button:focus-visible{outline:2px solid white;outline-offset:2px}.campaign-briefing{min-height:100dvh;background:radial-gradient(ellipse at 80% 20%,#263a3b,#10171c 65%);color:#edf1ef;font-family:Arial,sans-serif}.campaign-briefing header{display:flex;justify-content:space-between;align-items:center;padding:24px 5vw;border-bottom:1px solid #ffffff1c;font-size:12px}.brand{font-size:26px;font-weight:900;letter-spacing:-1.5px}.brand span{color:#ffb15c}.mission-select{max-width:1180px;margin:14px auto 0;padding:0 5vw;display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.mission-select a{display:flex;flex-direction:column;gap:8px;padding:16px;border:1px solid #ffffff25;border-radius:5px;background:#ffffff04}.mission-select a.selected{border-color:#efb36b;background:#efb36b13}.mission-select a:focus-visible{outline:2px solid #efb36b;outline-offset:3px}.mission-select small,.mission-select span{font-size:10px;color:#a5b4bc}.mission-select small{color:#efb36b}.mission-select strong{font-size:17px}.campaign-briefing section{max-width:1180px;margin:auto;padding:56px 5vw;display:grid;grid-template-columns:1.3fr 1fr;gap:70px}.eyebrow{color:#efb36b;font-size:11px;letter-spacing:.16em;text-transform:uppercase}h1{font-size:clamp(40px,6vw,76px);line-height:1.04;font-weight:800;letter-spacing:-.05em;margin:16px 0 24px}.brief-text{font-size:15px;line-height:1.8;color:#b5c1c7}.brief-meta{display:flex;flex-wrap:wrap;gap:16px;margin:24px 0;font-size:10px;letter-spacing:.06em;color:#efb36b}ol{list-style:none;border-block:1px solid #ffffff1c;margin:20px 0;padding:10px 0}li{display:flex;gap:18px;padding:14px 0}li>span{color:#efb36b;font-size:11px;padding-top:3px}li strong{font-size:14px}li p{font-size:12px;color:#a5b4bc;line-height:1.6;margin:5px 0 0}.deploy{display:flex;align-items:center;justify-content:space-between;background:#efb36b;color:#141a1f;width:100%;min-height:52px;padding:14px 20px;font-weight:700;border-radius:4px;margin-top:22px}.deploy:disabled{opacity:.5}.deploy:focus-visible,.restart:focus-visible{outline:2px solid white;outline-offset:4px}.restart{padding:14px 0;font-size:12px;text-decoration:underline}.save-note{font-size:11px;line-height:1.7;color:#90a0a9;margin-top:18px}.completion,.checkpoint{color:#b8d9b0;font-size:12px;margin-top:12px}.operation-map{align-self:start;background:#152328;border:1px solid #ffffff20;padding:22px;box-shadow:0 24px 60px #0004}.map-caption{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.12em;color:#aebdb9}.operation-map svg{width:100%;margin-top:16px}.operation-map>p{color:#efb36b;font-size:10px;margin:20px 0 12px}.operation-map blockquote{font-size:23px;line-height:1.4;font-weight:700}@media(max-width:760px){.campaign-briefing section{grid-template-columns:1fr;gap:30px;padding-top:30px}.operation-map{display:none}.campaign-briefing header{padding:18px 5vw}h1{font-size:46px}}@media(max-height:500px){.campaign-briefing section{padding-top:24px}.operation-map{display:none}.campaign-briefing section{grid-template-columns:1fr;max-width:780px}h1{font-size:36px}}
</style>

<style scoped>
@media(max-width:900px){.mission-select{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px}.mission-select a{flex:0 0 190px;scroll-snap-align:start;padding:12px}.mission-select strong{font-size:15px}.campaign-navigation>p span{display:none}.act-tabs button{font-size:10px;padding:8px 10px}.campaign-briefing section{padding-top:28px}}
</style>
