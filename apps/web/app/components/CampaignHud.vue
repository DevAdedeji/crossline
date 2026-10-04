<script setup lang="ts">
import { CAMPAIGN_OBJECTIVES, EXTRACTION_MISSION, type CampaignState } from '@crossline/shared/campaign'
import type { Combatant } from '@crossline/shared/combat'
const props = defineProps<{ state: CampaignState; player?: Combatant; touch: boolean; heading: number; saved: boolean }>()
const emit = defineEmits<{ interact: [held: boolean] }>()
const objective = computed(() => props.state.waiting ? { ...CAMPAIGN_OBJECTIVES.extract, title: 'Return to Finch', position: props.state.captive } : CAMPAIGN_OBJECTIVES[props.state.stage])
const distance = computed(() => props.player ? Math.round(Math.hypot(props.player.x-objective.value.position.x, props.player.z-objective.value.position.z)) : 0)
const bearing = computed(() => props.player ? Math.atan2(objective.value.position.x-props.player.x, objective.value.position.z-props.player.z)*180/Math.PI-props.heading : 0)
const progress = computed(() => Math.min(100, props.state.progressMs / (props.state.stage === 'extract' ? EXTRACTION_MISSION.extractMs : EXTRACTION_MISSION.interactMs) * 100))
function hold(event: PointerEvent) { (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); emit('interact', true) }
</script>
<template>
  <section class="mission-hud" :class="{ mobile: touch }" aria-label="Mission objective" :data-stage="state.stage">
    <div class="objective-heading"><span>CHAPTER 01 / {{ state.stage === 'relay' ? '01' : state.stage === 'rescue' ? '02' : '03' }} OF 03</span><span><i :style="{ transform: `rotate(${bearing}deg)` }">↑</i> {{ distance }} m</span></div>
    <strong>{{ objective.title }}</strong>
    <p v-if="state.waiting" class="waiting">Finch is waiting. Return to them to continue.</p>
    <p v-else-if="state.following">Finch is following · Keep within 18 m</p>
    <p v-else>{{ state.stage === 'relay' ? 'North courtyard / alarm terminal' : 'Relay office / ground floor' }}</p>
    <div v-if="state.progressMs > 0" class="progress" role="progressbar" aria-label="Objective progress" :aria-valuenow="Math.round(progress)" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: `${progress}%` }" /></div>
    <p v-if="state.progressMs > 0 && state.stage === 'extract'">Extraction in {{ Math.ceil((EXTRACTION_MISSION.extractMs-state.progressMs)/1000) }}s</p>
    <p v-if="!saved" class="waiting">Device storage unavailable. This checkpoint lasts until you leave.</p>
  </section>
  <div class="mission-radio" :class="{ mobile: touch }" :key="state.radio" role="status">{{ state.radio }}</div>
  <button v-if="state.canInteract" data-ui-action class="mission-interact" :class="{ mobile: touch }" @pointerdown.prevent.stop="hold" @pointerup.prevent.stop="emit('interact', false)" @pointercancel="emit('interact', false)" @lostpointercapture="emit('interact', false)">
    {{ touch ? 'HOLD' : 'HOLD E / Y / △' }} · {{ state.stage === 'relay' ? 'DISABLE RELAY' : 'RELEASE FINCH' }}
  </button>
</template>
<style scoped>
.mission-hud{position:absolute;top:90px;right:32px;width:290px;background:#141e25e8;border:1px solid #ffffff24;border-left:3px solid #efb36b;border-radius:5px;padding:14px 16px;pointer-events:none;color:#eef1ec}.objective-heading{display:flex;justify-content:space-between;gap:12px;color:#efb36b;font:9px Arial;letter-spacing:.06em}.objective-heading i{display:inline-block;font-size:16px;font-style:normal;margin-right:4px}.mission-hud strong{display:block;font-size:16px;margin-top:9px}.mission-hud p{font-size:11px;line-height:1.5;margin-top:7px;color:#bac5ca}.mission-hud .waiting{color:#ffd29b}.progress{height:4px;background:#ffffff26;margin-top:12px}.progress i{display:block;height:100%;background:#efb36b}.mission-radio{position:absolute;left:50%;bottom:145px;transform:translateX(-50%);max-width:470px;width:max-content;padding:10px 16px;background:#102128de;border-left:2px solid #99c8b5;color:#d2e5dc;font:12px/1.5 Arial;pointer-events:none;animation:radio-fade 9s forwards}.mission-interact{position:absolute;bottom:93px;left:50%;transform:translateX(-50%);z-index:25;min-height:48px;padding:12px 18px;border:1px solid #efb36b;background:#182229ee;color:#ffce91;font-size:12px;font-weight:700;border-radius:5px;touch-action:none;user-select:none}.mission-hud.mobile{top:54px;right:auto;left:110px;width:min(270px,calc(100vw - 255px));padding:8px 10px}.mobile .objective-heading{font-size:8px}.mission-hud.mobile strong{font-size:12px;margin-top:4px}.mission-hud.mobile p{font-size:9px;margin-top:3px}.mission-radio.mobile{bottom:94px;max-width:38vw;font-size:9px;padding:6px 8px}.mission-interact.mobile{bottom:48px;max-width:40vw;font-size:10px;min-height:44px;padding:8px 12px}@keyframes radio-fade{0%,75%{opacity:1}100%{opacity:0}}@media(prefers-reduced-motion:reduce){.mission-radio{animation:none}}
</style>
