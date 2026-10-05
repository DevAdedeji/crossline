<script setup lang="ts">
import { selectController, controllerButtons } from '~/game/controller'
import { prepareEntry, type EntryInput } from '~/game/entry'
import { CAMPAIGN_MISSIONS, getMissionTasks, getCampaignMission } from '@crossline/shared/campaign'
import { readCampaignProgress, saveCampaignProgress } from '~/game/campaignProgress'
const route=useRoute()
const selected=ref<string>(),act=ref(0),launching=ref(false),briefing=ref<HTMLDialogElement>()
const mission=computed(()=>getCampaignMission(selected.value))
const progress=ref<ReturnType<typeof readCampaignProgress>>()
const tasks=computed(()=>getMissionTasks(mission.value))
const checkpoint=computed(()=>mission.value.tasks?tasks.value[progress.value?.objectiveIndex??0]?.title:mission.value.objectives[progress.value?.checkpoint??'relay'].title)
const acts=['Opening moves','Supply lines','Counteroffensive','Endgame']
const visibleMissions=computed(()=>CAMPAIGN_MISSIONS.slice(act.value*5,act.value*5+5))
let lastCard:HTMLElement|undefined,frame=0,previous:boolean[]=[],directionHeld=0,focusIndex=0
async function select(id:string){
  focusIndex=CAMPAIGN_MISSIONS.findIndex(m=>m.id===id)
  lastCard=document.activeElement as HTMLElement;selected.value=id;progress.value=readCampaignProgress(id)
  await nextTick();briefing.value?.showModal();briefing.value?.querySelector<HTMLButtonElement>('.deploy')?.focus()
}
function close(){briefing.value?.close();selected.value=undefined;lastCard?.focus()}
async function deploy(restart=false,input?:EntryInput){
  if(launching.value)return
  launching.value=true
  const missionId=mission.value.id
  if(restart&&progress.value)saveCampaignProgress({...progress.value,checkpoint:'relay',objectiveIndex:0,cleared:[],elapsedMs:0})
  briefing.value?.close()
  await prepareEntry(input??(matchMedia('(pointer: coarse)').matches?'touch':'mouse'))
  await navigateTo(`/play?mode=campaign&mission=${missionId}`)
}
function poll(){
  const pad=selectController(Array.from(navigator.getGamepads?.()??[]))
  if(pad&&document.hasFocus()&&!document.hidden){
    const buttons=controllerButtons(pad),edge=(n:number)=>buttons[n]&&!previous[n]
    const direction=buttons[15]||buttons[13]||(pad.axes[0]??0)>.6?1:buttons[14]||buttons[12]||(pad.axes[0]??0)<-.6?-1:0
    if(selected.value){
      const controls=Array.from(briefing.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[])
      if(direction&&direction!==directionHeld){const index=controls.indexOf(document.activeElement as HTMLButtonElement);controls[(index+direction+controls.length)%controls.length]?.focus()}
      directionHeld=direction
      if(edge(1))close()
      else if(edge(0)){const focused=document.activeElement;if(focused?.classList.contains('close-briefing'))close();else void deploy(Boolean(focused?.classList.contains('restart')),'pad')}
    }else{
      if(direction&&direction!==directionHeld){focusIndex=(focusIndex+direction+CAMPAIGN_MISSIONS.length)%CAMPAIGN_MISSIONS.length;act.value=Math.floor(focusIndex/5);void nextTick(()=>document.getElementById(`mission-${CAMPAIGN_MISSIONS[focusIndex]!.id}`)?.focus())}
      directionHeld=direction
      if(edge(0))void select(CAMPAIGN_MISSIONS[focusIndex]!.id)
      if(edge(1))void navigateTo('/')
    }
    previous=buttons
  }
  frame=requestAnimationFrame(poll)
}
onMounted(()=>{
  if(typeof route.query.mission==='string'){const m=getCampaignMission(route.query.mission);act.value=Math.floor((Number(m.chapter)-1)/5);void select(m.id)}
  // Ignore a held menu confirmation until released.
  const pad=selectController(Array.from(navigator.getGamepads?.()??[]));previous=pad?controllerButtons(pad):[]
  frame=requestAnimationFrame(poll)
})
onBeforeUnmount(()=>cancelAnimationFrame(frame))
</script>
<template>
  <main class="campaign-gallery">
    <header><NuxtLink to="/" class="brand">CROSSLINE<span>+</span></NuxtLink><NuxtLink to="/">← Back to modes</NuxtLink></header>
    <div class="gallery-content">
      <div class="gallery-heading"><div><p>OPERATION BREAKWATER</p><h1>Choose your mission.</h1></div><span>20 missions · Progress saved on this device</span></div>
      <div class="act-tabs" role="group" aria-label="Campaign acts"><button v-for="(name,index) in acts" :key="name" :aria-pressed="act===index" @click="act=index;focusIndex=index*5">{{ name }}</button></div>
      <nav class="mission-select" aria-label="Campaign missions">
        <button v-for="item in visibleMissions" :id="`mission-${item.id}`" :key="item.id" @focus="focusIndex=CAMPAIGN_MISSIONS.findIndex(m=>m.id===item.id)" @click="select(item.id)">
          <img :src="`/campaign/${item.id}.jpg`" alt="" width="800" height="500" loading="lazy" />
          <span>{{ item.title }}<i aria-hidden="true">↗</i></span>
        </button>
      </nav>
    </div>
    <dialog ref="briefing" class="mission-briefing" aria-labelledby="briefing-title" @cancel.prevent="close" @click="event=>{if(event.target===briefing)close()}">
      <template v-if="selected">
        <button class="close-briefing" aria-label="Close mission briefing" @click="close">×</button>
        <p class="eyebrow">{{ mission.world.name }}</p><h2 id="briefing-title">{{ mission.title }}</h2>
        <p class="brief-copy">{{ mission.briefing }}</p>
        <p class="objective"><span>{{ progress?.checkpoint!=='relay'?'YOUR CHECKPOINT':'FIRST OBJECTIVE' }}</span>{{ checkpoint }}</p>
        <p class="hint">Step into the marked circles to complete objectives. {{ mission.companion?`Keep ${mission.companion} close after the rescue.`:'Use cover and watch for enemy grenades.' }}</p>
        <button class="deploy" :disabled="launching" @click="deploy()">{{ launching?'Loading…':progress?.checkpoint!=='relay'?'Got it, continue':'Got it, let’s go' }} <span aria-hidden="true">→</span></button>
        <button v-if="progress?.checkpoint!=='relay'" class="restart" :disabled="launching" @click="deploy(true)">Restart from the beginning</button>
      </template>
    </dialog>
  </main>
</template>
<style scoped>
.campaign-gallery{min-height:100dvh;background:radial-gradient(ellipse at 80% 0,#293838,#101619 65%);color:#eef1ed;font-family:Arial,sans-serif}.campaign-gallery header{display:flex;justify-content:space-between;align-items:center;padding:24px 5vw;border-bottom:1px solid #ffffff18;font-size:13px}.brand{font-size:27px;font-weight:900;letter-spacing:-1.5px}.brand span{color:#efb36b}.gallery-content{max-width:1280px;margin:auto;padding:46px 5vw 70px}.gallery-heading{display:flex;justify-content:space-between;align-items:end;gap:20px}.gallery-heading p,.eyebrow{font-size:10px;letter-spacing:.14em;color:#efb36b}.gallery-heading h1{font-size:clamp(28px,4vw,46px);font-weight:750;letter-spacing:-.04em;margin-top:12px}.gallery-heading>span{font-size:11px;color:#9daaa9;margin-bottom:5px}.act-tabs{display:flex;gap:8px;margin:30px 0 24px;overflow:auto;padding-bottom:4px}.act-tabs button{white-space:nowrap;min-height:44px;padding:10px 18px;border:1px solid #ffffff25;border-radius:30px;font-size:12px;color:#b3bfbd}.act-tabs button[aria-pressed=true]{background:#efb36b;border-color:#efb36b;color:#192223}.mission-select{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}.mission-select button{text-align:left;overflow:hidden;border:1px solid #ffffff20;background:#192225;border-radius:8px;transition:transform .15s,border-color .15s}.mission-select button:hover{transform:translateY(-3px);border-color:#efb36b}.mission-select img{width:100%;aspect-ratio:8/5;object-fit:cover;background:#33443f}.mission-select span{display:flex;justify-content:space-between;align-items:center;padding:18px;font-size:18px;font-weight:600}.mission-select i{font-style:normal;color:#efb36b}button:focus-visible,a:focus-visible{outline:2px solid #efb36b;outline-offset:4px}.mission-briefing{position:fixed;inset:0;margin:auto;width:min(480px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;background:#192427;color:#eef1ed;border:1px solid #50605a;border-radius:12px;padding:32px;box-shadow:0 24px 100px #0008}.mission-briefing::backdrop{background:#081011cc}.close-briefing{position:absolute;top:8px;right:8px;width:44px;height:44px;font-size:26px;color:#aebdb7}.mission-briefing h2{font-size:30px;font-weight:750;letter-spacing:-.03em;margin:12px 0 18px}.brief-copy{font-size:14px;line-height:1.7;color:#c7d0ca}.objective{margin-top:22px;padding:15px 0;border-block:1px solid #ffffff1c;font-size:14px;line-height:1.5}.objective span{display:block;font-size:9px;letter-spacing:.1em;color:#efb36b;margin-bottom:6px}.hint{font-size:11px;line-height:1.6;color:#9fafa7;margin:16px 0 22px}.deploy{display:flex;justify-content:space-between;align-items:center;background:#efb36b;color:#142023;width:100%;min-height:48px;padding:12px 18px;border-radius:5px;font-weight:700;font-size:14px}.deploy:disabled{opacity:.6}.restart{display:block;min-height:44px;margin:auto;font-size:12px;text-decoration:underline;color:#b7c4bb}@media(max-width:900px){.mission-select{grid-template-columns:repeat(2,minmax(0,1fr))}.gallery-heading>span{display:none}}@media(max-width:520px){.gallery-content{padding-top:28px}.mission-select{grid-template-columns:1fr;gap:18px}.act-tabs{margin-top:22px}.act-tabs button{padding:8px 14px}.mission-briefing{padding:24px}.mission-select span{font-size:17px;padding:16px}}@media(max-height:500px){.mission-briefing{width:min(600px,calc(100vw - 32px));padding:20px 26px}.mission-briefing h2{font-size:24px;margin:6px 0 10px}.objective{margin-top:12px;padding:8px 0}.hint{margin:10px 0}.brief-copy{font-size:12px}.gallery-content{padding-top:24px}}@media(prefers-reduced-motion:reduce){.mission-select button{transition:none}}
</style>
