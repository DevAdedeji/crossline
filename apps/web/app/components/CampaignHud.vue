<script setup lang="ts">
import type { MissionWaypoint } from '~/game/campaignWaypoint'
import { CAMPAIGN_OBJECTIVES, EXTRACTION_MISSION, type CampaignState } from '@crossline/shared/campaign'
import type { Combatant } from '@crossline/shared/combat'
const props = defineProps<{ state: CampaignState; player?: Combatant; touch: boolean; heading: number; saved: boolean; waypoints: MissionWaypoint[] }>()
const objective = computed(() => props.state.waiting ? { ...CAMPAIGN_OBJECTIVES.extract, title: 'Return to Finch', position: props.state.captive } : CAMPAIGN_OBJECTIVES[props.state.stage])
const distance = computed(() => props.player ? Math.round(Math.hypot(props.player.x-objective.value.position.x, props.player.z-objective.value.position.z)) : 0)
const bearing = computed(() => props.player ? Math.atan2(objective.value.position.x-props.player.x, objective.value.position.z-props.player.z)*180/Math.PI-props.heading : 0)
const progress = computed(() => Math.min(100, props.state.progressMs / (props.state.stage === 'extract' ? EXTRACTION_MISSION.extractMs : EXTRACTION_MISSION.interactMs) * 100))
</script>
<template>
  <div v-for="point in waypoints" :key="point.id" class="mission-waypoint" :class="{ secondary: point.secondary, mobile: touch, edge: point.edge }"
    :style="{ left: `${point.x}%`, top: `${point.y}%` }" :data-waypoint="point.id" :data-edge="point.edge" :aria-label="`${point.label}, ${point.distance} metres`">
    <svg class="waypoint-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path v-if="point.edge" d="M8 5 15 12 8 19" :transform="`rotate(${point.angle} 12 12)`" />
      <path v-else d="M8 2H16L22 8V16L16 22H8L2 16V8Z" />
    </svg>
  </div>
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
  <div v-if="state.canInteract" class="mission-interact" :class="{ mobile: touch }" role="status">
    {{ state.stage === 'relay' ? 'DISABLING RELAY' : 'RELEASING FINCH' }} · STAY IN THE CIRCLE
  </div>
</template>
<style scoped>
.mission-waypoint{position:absolute;transform:translate(-50%,-50%);z-index:4;pointer-events:none;color:#ffce87;opacity:.8}.waypoint-icon{display:block;width:24px;height:24px;overflow:visible;filter:drop-shadow(0 1px 2px #000)}.waypoint-icon path{stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.mission-waypoint.secondary{color:#9be4cd;opacity:.65}.mission-waypoint.secondary .waypoint-icon,.mission-waypoint.mobile .waypoint-icon{width:20px;height:20px}

.mission-hud{position:absolute;top:90px;right:32px;width:290px;background:#141e25e8;border:1px solid #ffffff24;border-left:3px solid #efb36b;border-radius:5px;padding:14px 16px;pointer-events:none;color:#eef1ec}.objective-heading{display:flex;justify-content:space-between;gap:12px;color:#efb36b;font:9px Arial;letter-spacing:.06em}.objective-heading i{display:inline-block;font-size:16px;font-style:normal;margin-right:4px}.mission-hud strong{display:block;font-size:16px;margin-top:9px}.mission-hud p{font-size:11px;line-height:1.5;margin-top:7px;color:#bac5ca}.mission-hud .waiting{color:#ffd29b}.progress{height:4px;background:#ffffff26;margin-top:12px}.progress i{display:block;height:100%;background:#efb36b}.mission-radio{position:absolute;left:50%;bottom:145px;transform:translateX(-50%);max-width:470px;width:max-content;padding:10px 16px;background:#102128de;border-left:2px solid #99c8b5;color:#d2e5dc;font:12px/1.5 Arial;pointer-events:none;animation:radio-fade 9s forwards}.mission-interact{position:absolute;bottom:93px;left:50%;transform:translateX(-50%);z-index:25;min-height:48px;padding:12px 18px;border:1px solid #efb36b;background:#182229ee;color:#ffce91;font-size:12px;font-weight:700;border-radius:5px;pointer-events:none;user-select:none}.mission-hud.mobile{top:54px;right:auto;left:110px;width:min(270px,calc(100vw - 255px));padding:8px 10px}.mobile .objective-heading{font-size:8px}.mission-hud.mobile strong{font-size:12px;margin-top:4px}.mission-hud.mobile p{font-size:9px;margin-top:3px}.mission-radio.mobile{bottom:94px;max-width:38vw;font-size:9px;padding:6px 8px}.mission-interact.mobile{bottom:48px;max-width:40vw;font-size:10px;min-height:44px;padding:8px 12px}@keyframes radio-fade{0%,75%{opacity:1}100%{opacity:0}}@media(prefers-reduced-motion:reduce){.mission-radio{animation:none}}
</style>
