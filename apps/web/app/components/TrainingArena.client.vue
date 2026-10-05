<script setup lang="ts">
import { grenadePresentation } from '~/game/grenadePresentation'
import type { PlayerGrenade } from '@crossline/shared/campaignGrenades'
import { campaignWaypoints, type MissionWaypoint } from '~/game/campaignWaypoint'
import { CAMPAIGN_MISSIONS, activeCampaignTask, getMissionTasks, getCampaignMission, type CampaignState } from '@crossline/shared/campaign'
import { readCampaignProgress, saveCampaignProgress } from '~/game/campaignProgress'
import { campaignPresentation } from '~/game/campaignPresentation'
import { attackBearing, relativeBearing } from '~/game/combatFeedback'
import { localSession, type ArenaState, type ArenaSession } from '~/game/arenaSession'
import { observeArenaViewport } from '~/game/viewport'
import { NetworkHealth } from '~/game/networkHealth'
import { MovementPrediction } from '~/game/prediction'
import { StairCamera } from '~/game/stairCamera'
import { WeaponFeedback } from '~/game/weaponFeedback'
import { onlineJoinToken } from '~/game/account'
import { playerLabels } from '~/game/playerLabels'
import type { Leaderboard } from '@crossline/shared'
import { takeEntry } from '~/game/entry'
import type { Engine } from '@babylonjs/core/Engines/engine'
import { Client, type Room } from '@colyseus/sdk'
import { ONLINE_CAPACITY_TARGET, SOLO, stanceEye, type HealthPickup, TICK_MS, readStick, TRAINING_WORLD, COMBAT_WORLD, COMBAT_DISTRICTS, COMBAT_BOT_COUNT } from '@crossline/shared'
import {
  RIFLE, QUICK_MATCH_MS, TRAINING,
  aimedTarget,
  direction,
  type CombatInput,
  type Combatant,
  type GameEvent,
  type Phase,
  type GameMode,
} from '@crossline/shared/combat'
import { healthPickups } from '~/game/healthPickups'
import { createUrbanScene } from '~/game/createUrbanScene'
import { loadTrainingAssets } from '~/game/trainingAssets'
import { combatPresentation, trainingAudio } from '~/game/combatPresentation'
import { rotateLook, MOUSE_SENSITIVITY } from '~/game/look'
import { selectController, controllerActivity, controllerButtons, controllerFire, loadFireBinding, DEFAULT_FIRE_BINDING, type FireBinding } from '~/game/controller'
const entry=takeEntry()
let pendingLaunch=Boolean(entry), recordedRound=''
const personalBest=ref(0), newBest=ref(false)
const props = withDefaults(defineProps<{ mode?: GameMode; missionId?: string }>(), { mode: 'training' })
const mission = computed(() => getCampaignMission(props.missionId))
const nextMission = computed(() => CAMPAIGN_MISSIONS[CAMPAIGN_MISSIONS.findIndex(item => item.id === mission.value.id) + 1])
const isCampaign = computed(() => props.mode === 'campaign')
const waypoints = ref<MissionWaypoint[]>([])
const campaign = ref<CampaignState>(), checkpointSaved = ref(true)
const campaignObjective = computed(() => campaign.value ? activeCampaignTask(campaign.value) : getMissionTasks(mission.value)[0]!)
let lastCampaignSave = ''
const isOnline = computed(() => props.mode === 'online')
const leaders=ref<Leaderboard>(),leadersUnavailable=ref(false),joinError=ref(''),showLeaders=ref(false)
const networkStalled=ref(false), networkNotice=ref('')
const onlineEntered = ref(false), onlinePaused = ref(false), onlineCapacity = ref(ONLINE_CAPACITY_TARGET), roomCode = ref('')
const isSolo = computed(() => props.mode === 'solo')
const world = computed(() => isCampaign.value ? mission.value.world : props.mode !== 'training' ? COMBAT_WORLD : TRAINING_WORLD)
const radarRadius = computed(() => props.mode === 'training' ? 28 : 42)
const radarBox = computed(() => { const r = radarRadius.value; return `${(self.value?.x ?? 0)-r} ${-(self.value?.z ?? 0)-r} ${r*2} ${r*2}` })
const modeTitle = computed(() => isCampaign.value ? 'Campaign' : isOnline.value ? 'Online Free-for-All' : isSolo.value ? 'Solo vs Bots' : 'Training')
const sessionWord = computed(() => isCampaign.value ? 'mission' : props.mode !== 'training' ? 'match' : 'training')
const showControls = ref(false)
const fireBinding = ref<FireBinding>(DEFAULT_FIRE_BINDING)
const bindingFire = ref(false)
const triggerLevel = ref(0)
const fireLabel = computed(() => fireBinding.value.kind === 'button'
  ? fireBinding.value.index === 7 ? 'RT / R2' : `BUTTON ${fireBinding.value.index + 1}`
  : `TRIGGER AXIS ${fireBinding.value.index + 1}`)
let bindBaseline: { buttons: number[]; axes: number[] } | undefined
function bindFire() {
  const pad = selectController(Array.from(navigator.getGamepads?.() ?? []))
  if (!pad) return
  bindBaseline = { buttons: pad.buttons.map(b => Math.max(b.value, Number(b.pressed))), axes: [...pad.axes] }
  bindingFire.value = true
}
function saveFireBinding(pad: Gamepad, binding: FireBinding) {
  fireBinding.value = binding
  bindingFire.value = false
  try { localStorage.setItem(`crossline.fire.${pad.id}`, JSON.stringify(binding)) } catch { /* Session binding still works. */ }
}
const viewport=ref({width:0,height:0}),stopViewport=ref<(()=>void)>()
const touchDevice=ref(false),portrait=ref(false),touchActive=ref(false)
let touchMovement={x:0,z:0},touchFiring=false,touchAiming=false
const canvas = ref<HTMLCanvasElement>(),
  status = ref('Connecting'),
  phase = ref<Phase>('ready'),
  confirmedPhase = ref<Phase>('ready'),
  elapsed = ref(0),
  duration = ref(180000),
  round = ref(1)
const packs = ref<HealthPickup[]>([]), healAmount=ref(0), healUntil=ref(0)
const crouchToggle=ref(false)
const actors = ref<Combatant[]>([]),
  self = ref<Combatant>(),
  captured = ref(false),
  padActive = ref(false),
  padReady = ref(false),
  padStatus = ref('Connect a controller and press a button')
const position = ref('0.0 / -21.0'),
  altitude = ref('0.0'),
  area = ref('SOUTH APPROACH'),
  heading = ref(0),
  pitch = ref(0),
  captureError = ref(''),
  muted = ref(false)
const clientPosition=ref(''),feedbackShots=ref(0)
const weaponFeedback=new WeaponFeedback()
const targetId = ref<string>()
const incoming = ref<{ source: string; bearing: number; until: number }[]>([])
const elimination = ref<{ name: string; until: number }>()
const hitHeadshot = ref(false)
const eliminatedBy = ref<string>()
const hitUntil = ref(0),
  hitKill = ref(false),
  damageUntil = ref(0),
  now = ref(0),
  feed = ref<{ text: string; until: number }[]>([]),
  menuIndex = ref(0)
const look = { yaw: 0, pitch: 0 },
  keys = new Set<string>(),
  audio = trainingAudio(entry?.audio),
  config = useRuntimeConfig()
let engine: Engine | undefined,
  room: ArenaSession | undefined,
  timer: ReturnType<typeof setInterval> | undefined,
  stopped = false,
  mouseFire = false,
  mouseAim = false
let padMovement = { x: 0, y: 0 },
  padFire = false,
  padAim = false,
  previousButtons: boolean[] = [],
  menuAxis = false,
  padIndex: number | undefined,
  selectFireArmed = false
const active = computed(
  () =>
    status.value === 'Connected' && !networkStalled.value &&
    phase.value === 'playing' &&
    (captured.value || padActive.value || touchActive.value) && !(touchDevice.value && portrait.value),
)
const seconds = computed(() => Math.ceil(Math.max(0, duration.value - elapsed.value) / 1000))
const time = computed(
  () => isCampaign.value ? `${Math.floor(elapsed.value / 60000)}:${String(Math.floor(elapsed.value / 1000) % 60).padStart(2, '0')}` : isOnline.value ? '∞' : `${Math.floor(seconds.value / 60)}:${String(seconds.value % 60).padStart(2, '0')}`,
)
const accuracy = computed(() =>
  self.value?.shots ? Math.round((self.value.hits / self.value.shots) * 100) : 0,
)
const reloadLeft = computed(() => Math.max(0, (self.value?.reloadUntil ?? 0) - elapsed.value))
const menuItems = computed(() =>
  phase.value === 'finished'
    ? isCampaign.value ? [...(campaign.value?.outcome === 'success' && nextMission.value ? ['Next mission'] : []), campaign.value?.outcome === 'success' ? 'Replay mission' : 'Retry checkpoint', 'Mission briefing'] : ['Play again', 'Return to menu']
    : isOnline.value ? [onlineEntered.value ? 'Resume match' : 'Enter arena', 'Return to menu']
    : phase.value === 'paused'
      ? [`Resume ${sessionWord.value}`, isCampaign.value ? 'Retry checkpoint' : `Restart ${sessionWord.value}`, isCampaign.value ? 'Abort mission' : 'Finish session', 'Return to menu']
      : [`Start ${sessionWord.value}`, 'Return to menu'],
)
let locallyPaused=false
let resetConnection=()=>{}
function action(value: string) {
  if(value==='start'){resetConnection();networkNotice.value=''}
  if(value==='pause')locallyPaused=true
  else if(value==='start'||value==='restart'||value==='finish')locallyPaused=false
  if(status.value === 'Connected')room?.send('action', value)
}
function readInput():CombatInput {
      const enabled = active.value,
        forward = enabled
          ? touchActive.value ? touchMovement.z : padActive.value
            ? -padMovement.y
            : Number(keys.has('KeyW')) - Number(keys.has('KeyS'))
          : 0,
        right = enabled
          ? touchActive.value ? touchMovement.x : padActive.value
            ? padMovement.x
            : Number(keys.has('KeyD')) - Number(keys.has('KeyA'))
          : 0,
        length = Math.max(1, Math.hypot(forward, right))
      return {
        x: (Math.sin(look.yaw) * forward + Math.cos(look.yaw) * right) / length,
        z: (Math.cos(look.yaw) * forward - Math.sin(look.yaw) * right) / length,
        ...look,
        fire: enabled && (touchActive.value ? touchFiring : padActive.value ? padFire : mouseFire),
        aim: enabled && (touchActive.value ? touchAiming : padActive.value ? padAim : mouseAim),
        crouch: enabled ? crouchToggle.value || keys.has('ControlLeft') || keys.has('ControlRight') : (self.value?.crouch ?? 0)>0,
      }
}
function clearInput() {
  keys.clear()
  touchMovement={x:0,z:0};touchFiring=false;touchAiming=false
  mouseFire = false
  mouseAim = false
  padMovement = { x: 0, y: 0 }
  padFire = false
  padAim = false
  selectFireArmed = false
  if(status.value === 'Connected')room?.send('input', { x: 0, z: 0, ...look, fire: false, aim: false, crouch: (self.value?.crouch ?? 0)>0 })
}
function release() {
  clearInput()
  padActive.value = false
  touchActive.value=false
  if (document.pointerLockElement) document.exitPointerLock()
}
function pause() {
  audio.stop()
  if (phase.value === 'playing') {
    if(isOnline.value)onlinePaused.value=true
    action('pause')
    phase.value = 'paused'
    menuIndex.value = 0
  }
  release()
}
function gamepadDisconnected(event?: Event) {
  if (event && 'gamepad' in event && (event as GamepadEvent).gamepad.index !== padIndex) return
  padIndex = undefined
  if (padActive.value) pause()
  padReady.value = false
  padStatus.value = 'Controller disconnected — keyboard/mouse available'
  previousButtons = []
}
async function start(usePad = false) {
  if (status.value !== 'Connected' || networkStalled.value || (touchDevice.value && portrait.value)) return
  audio.unlock()
  captureError.value = ''
  if(touchDevice.value && !usePad) {
    touchActive.value=true;padActive.value=false
    if(isOnline.value){onlineEntered.value=true;onlinePaused.value=false;phase.value='playing'}
    action('start');return
  }
  if (usePad) {
    touchActive.value=false
    selectFireArmed = false
    padActive.value = true
    if(isOnline.value) { onlineEntered.value=true; onlinePaused.value=false; phase.value='playing' }
    action('start')
    return
  }
  try {
    if(!document.pointerLockElement)await canvas.value?.requestPointerLock()
    if (document.pointerLockElement === canvas.value || document.pointerLockElement === document.documentElement) {
      captured.value=true
      padActive.value = false
      if(isOnline.value) { onlineEntered.value=true; onlinePaused.value=false; phase.value='playing' }
      action('start')
    }
  } catch {
    captureError.value =
      'Mouse capture was declined. Click Start or Resume again, or press A on a controller.'
  }
}
function choose(index: number, usePad = false) {
  const label = menuItems.value[index]
  if (label === 'Next mission' && nextMission.value) { void navigateTo(`/campaign?mission=${nextMission.value.id}`); return }
  if (label === 'Mission briefing') { void navigateTo(`/campaign?mission=${mission.value.id}`); return }
  if (label === 'Return to menu') {
    void navigateTo('/')
    return
  }
  if (label === 'Finish session' || label === 'Abort mission') {
    action('finish')
    release()
    return
  }
  if (label === `Restart ${sessionWord.value}` || label === 'Play again' || label === 'Retry checkpoint' || label === 'Replay mission') {
    action('restart')
    Object.assign(look, { yaw: 0, pitch: 0 })
    menuIndex.value = 0
    void start(usePad)
    return
  }
  void start(usePad)
}
async function openLeaders(){
  if(!isOnline.value)return
  pause();showLeaders.value=true
  if(status.value==='Connected'){room?.send('leaderboard');return}
  try{leaders.value=await $fetch<Leaderboard>('/api/leaderboard');leadersUnavailable.value=false}catch{leadersUnavailable.value=true}
}
function toggleAudio() {
  muted.value = !muted.value
  audio.mute(muted.value)
}
function throwGrenade(){if(active.value&&(self.value?.grenades??0)>0)action('grenade')}
function reload() {
  if (active.value && reloadLeft.value === 0 && self.value && self.value.ammo < RIFLE.magazine) {
    action('reload')
  }
}
function keydown(event: KeyboardEvent) {
  if (event.code === 'Tab' && isOnline.value) {
    event.preventDefault()
    if (!event.repeat) { if (showLeaders.value) showLeaders.value=false; else void openLeaders() }
    return
  }
  if (showLeaders.value && event.code !== 'Escape') return
  if (event.code === 'Escape') {
    event.preventDefault()
    if(showLeaders.value){showLeaders.value=false;return}
    if (showControls.value) { showControls.value = false; bindingFire.value = false; return }
    pause()
    return
  }
  if ((event.target as HTMLElement)?.closest('input, [data-ui-action]')) return
  if (active.value) {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyG', 'KeyC', 'ControlLeft', 'ControlRight', 'Space'].includes(event.code))
      event.preventDefault()
    keys.add(event.code)
    if (event.code === 'KeyC' && !event.repeat) crouchToggle.value=!crouchToggle.value
    if (event.code === 'KeyG' && !event.repeat) throwGrenade()
    if (event.code === 'KeyR' && !event.repeat) reload()
  } else if (['ArrowUp', 'ArrowDown', 'Enter'].includes(event.code)) {
    event.preventDefault()
    if (event.code === 'Enter') choose(menuIndex.value)
    else
      menuIndex.value =
        (menuIndex.value + (event.code === 'ArrowDown' ? 1 : -1) + menuItems.value.length) %
        menuItems.value.length
  }
}
const keyup = (event: KeyboardEvent) => { keys.delete(event.code) }
function mouseLook(event: MouseEvent) {
  if (captured.value && active.value && (event.movementX || event.movementY)) {
    padActive.value = false
    Object.assign(
      look,
      rotateLook(look, event.movementX * MOUSE_SENSITIVITY, event.movementY * MOUSE_SENSITIVITY),
    )
  }
}
function mouseDown(event: MouseEvent) {
  if (!captured.value || !active.value) return
  if (event.button === 0) mouseFire = true
  if (event.button === 2) mouseAim = true
}
function mouseUp(event: MouseEvent) {
  if (event.button === 0) mouseFire = false
  if (event.button === 2) mouseAim = false
}
function pointerChange() {
  captured.value = document.pointerLockElement === canvas.value || document.pointerLockElement === document.documentElement
  if (!captured.value && !padActive.value && !touchActive.value && phase.value === 'playing') pause()
}
function hidden() {
  if (document.hidden) pause()
}
const resize = () => {if(touchDevice.value && portrait.value)pause();else if(pendingLaunch && self.value)launchEntry();void nextTick(()=>engine?.resize())}
function launchEntry(){if(!pendingLaunch || (touchDevice.value && portrait.value))return;pendingLaunch=false;void start(entry?.input==='pad')}
function touchMode(){if(phase.value!=='playing')return;touchActive.value=true;padActive.value=false}
function touchMove(x:number,z:number){touchMode();touchMovement={x,z}}
function touchLook(x:number,y:number){if(!active.value)return;touchMode();Object.assign(look,rotateLook(look,x*.004,y*.004))}
function touchFire(value:boolean){if(value)touchMode();touchFiring=value}
function touchAim(value:boolean){if(value)touchMode();touchAiming=value}
function pollPad(dt: number) {
  const pad = selectController(Array.from(navigator.getGamepads?.() ?? []), padIndex)
  if (!pad) {
    if (padReady.value || padActive.value) gamepadDisconnected()
    return
  }
  if (pad.index !== padIndex) {
    // A held menu button must be released after changing routes/controllers.
    previousButtons = controllerButtons(pad)
    menuAxis = false
    padIndex = pad.index
    fireBinding.value = loadFireBinding(pad.id)
  }
  padReady.value = true
  padStatus.value = document.hasFocus()
    ? `${pad.id} — ${pad.mapping === 'standard' ? 'standard mapping' : 'generic layout'}`
    : 'Controller connected — click the game to focus'
  const pressed = controllerButtons(pad),
    edge = (i: number) => pressed[i] && !previousButtons[i]
  triggerLevel.value = fireBinding.value.kind === 'button'
    ? Math.max(pad.buttons[fireBinding.value.index]?.value ?? 0, Number(pad.buttons[fireBinding.value.index]?.pressed ?? false))
    : Math.abs((pad.axes[fireBinding.value.index] ?? 0) - fireBinding.value.rest) / 2
  if (bindingFire.value && bindBaseline) {
    const buttonIndex = pad.buttons.findIndex((button, index) =>
      Math.max(button.value, Number(button.pressed)) - (bindBaseline!.buttons[index] ?? 0) > 0.35)
    const axisIndex = pad.axes.findIndex((value, index) => Math.abs(value - (bindBaseline!.axes[index] ?? 0)) > 0.6)
    if (buttonIndex >= 0) saveFireBinding(pad, { kind: 'button', index: buttonIndex })
    else if (axisIndex >= 0) saveFireBinding(pad, { kind: 'axis', index: axisIndex,
      rest: bindBaseline.axes[axisIndex] ?? 0,
      direction: Math.sign(pad.axes[axisIndex]! - (bindBaseline.axes[axisIndex] ?? 0)) })
    previousButtons = pressed
    return
  }
  if (document.hasFocus() && !document.hidden) {
    if(showLeaders.value){if(edge(0)||edge(1)||edge(8))showLeaders.value=false;previousButtons=pressed;return}
    if(isOnline.value && edge(8)){void openLeaders();previousButtons=pressed;return}
    if (phase.value === 'playing') {
      if (!pressed[0]) selectFireArmed = true
      if (!padActive.value && (controllerActivity(pad) || controllerFire(pad, fireBinding.value))) {
        const wasArmed = selectFireArmed
        touchActive.value=false
        clearInput()
        selectFireArmed = wasArmed
        padActive.value = true
        audio.unlock()
      }
      if (edge(11)) crouchToggle.value=!crouchToggle.value
      if (edge(9) || edge(1)) pause()
      if (padActive.value) {
        padMovement = readStick(pad.axes[0], pad.axes[1])
        const right = readStick(pad.axes[2], pad.axes[3])
        Object.assign(look, rotateLook(look, right.x * 2.4 * dt, right.y * 1.8 * dt))
        const boundToSelect = fireBinding.value.kind === 'button' && fireBinding.value.index === 0
        padFire = controllerFire(pad) ||
          (controllerFire(pad, fireBinding.value) && (!boundToSelect || selectFireArmed)) ||
          (selectFireArmed && Boolean(pressed[0]))
        padAim = Boolean(pressed[6])
        if (edge(2)) reload()
        if (edge(5)) throwGrenade()
      }
    } else {
      selectFireArmed = false
      if (edge(1)) {
        if(showLeaders.value){showLeaders.value=false;return}
    if (showControls.value) { showControls.value = false; bindingFire.value = false }
        else if (phase.value === 'paused') void start(true)
        else void navigateTo('/')
        previousButtons = pressed
        return
      }
      if (edge(3)) showControls.value = !showControls.value
      if (showControls.value) { previousButtons = pressed; return }
      const axis = pad.axes[1] ?? 0,
        direction = pressed[13] || axis > 0.55 ? 1 : pressed[12] || axis < -0.55 ? -1 : 0
      if (direction && !menuAxis)
        menuIndex.value =
          (menuIndex.value + direction + menuItems.value.length) % menuItems.value.length
      menuAxis = Boolean(direction)
      if (edge(0) || edge(9)) choose(menuIndex.value, true)
    }
  }
  previousButtons = pressed
}
onMounted(async () => {
  try{personalBest.value=Number(localStorage.getItem(`crossline.best.${props.mode}`))||0}catch{}
  duration.value=props.mode==='training'?180000:QUICK_MATCH_MS
  touchDevice.value=matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints>0
  stopViewport.value=observeArenaViewport(value=>{viewport.value=value;portrait.value=value.portrait;resize()})
  await nextTick()
  if (!canvas.value) return
  try {
    const arena = createUrbanScene(canvas.value, world.value, {mobile:touchDevice.value})
    engine = arena.engine
    const { scene, camera } = arena
    const cameraTarget = camera.position.clone()
    const prediction=new MovementPrediction(world.value)
    const stairCamera=new StairCamera()
    let inputSequence=0,lastInputFrame=performance.now()
    const networkHealth=new NetworkHealth();resetConnection=()=>networkHealth.reset(performance.now());resetConnection()
    status.value = 'Loading models'
    const [assets] = await Promise.all([loadTrainingAssets(scene), audio.prepare()])
    if (stopped) {
      scene.dispose()
      return
    }
    arena.addVehicles(assets)
    const grenadeVisuals=grenadePresentation(scene,camera)
    await grenadeVisuals.ready
    const missionVisuals = isCampaign.value ? campaignPresentation(scene, assets, arena.shadows, mission.value) : undefined
    const supplies = props.mode!=='training' ? healthPickups(scene) : undefined
    const labels=isOnline.value?playerLabels(scene,camera,world.value):undefined
    const visuals = combatPresentation(scene, camera, assets, arena.shadows, props.mode)
    await Promise.all([scene.whenReadyAsync(),visuals.ready])
    if (stopped) return
    engine.runRenderLoop(() => {
      const dt = Math.min(engine!.getDeltaTime(), 50) / 1000
      now.value = performance.now()
      pollPad(dt)
      const input=readInput()
      const predicted=prediction.view(input,active.value ? Math.min(TICK_MS,performance.now()-lastInputFrame) : 0,dt)
      if(predicted && self.value?.health && active.value){
        camera.position.set(predicted.x,stairCamera.update(predicted.y+stanceEye(predicted),dt),predicted.z)
        clientPosition.value=`${predicted.x.toFixed(3)} / ${predicted.z.toFixed(3)}`
      }else {camera.position.copyFrom(cameraTarget);stairCamera.reset()}
      const actor=self.value
      if(actor && weaponFeedback.fire(performance.now(),input.fire && active.value,actor,elapsed.value,props.mode)){
        visuals.fire();audio.sound('shot',true,actor,actor,look.yaw)
        feedbackShots.value++
      }
      camera.rotation.set(look.pitch, look.yaw, 0)
      if (campaign.value && canvas.value) waypoints.value = campaignWaypoints(campaign.value,
        {x:camera.position.x,y:camera.position.y,z:camera.position.z,...look,fov:camera.fov},
        canvas.value.clientWidth,canvas.value.clientHeight,touchDevice.value)
      heading.value = ((((look.yaw * 180) / Math.PI) % 360) + 360) % 360
      pitch.value = look.pitch
      const viewer = self.value
      targetId.value =
        active.value && viewer && viewer.health > 0
          ? aimedTarget(
              { x: viewer.x, y: viewer.y + stanceEye(viewer), z: viewer.z },
              direction(look.yaw, look.pitch),
              actors.value,
              viewer.id,
              elapsed.value,
              RIFLE.range,
              world.value,
            )
          : undefined
      visuals.frame(
        dt,
        active.value && (touchActive.value ? touchAiming : padActive.value ? padAim : mouseAim),
        keys.size > 0 || Math.hypot(padMovement.x, padMovement.y) > 0.1,
        reloadLeft.value,
        (self.value?.health ?? 0) > 0 && phase.value === 'playing',
        phase.value === 'playing',
      )
      audio.reload(
        reloadLeft.value,
        phase.value === 'playing' && (self.value?.health ?? 0) > 0,
        self.value?.reloadUntil ?? 0,
      )
      labels?.frame()
      scene.render()
    })
    document.addEventListener('mousemove', mouseLook)
    document.addEventListener('mousedown', mouseDown)
    document.addEventListener('mouseup', mouseUp)
    document.addEventListener('pointerlockchange', pointerChange)
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', keyup)
    window.addEventListener('blur', pause)
    window.addEventListener('gamepaddisconnected', gamepadDisconnected)
    resize()
    const client = new Client(String(config.public.matchUrl),{urlBuilder:url=>url.protocol==='http:'||url.protocol==='https:'?window.location.origin+'/api/match'+url.pathname+url.search:url.href})
    let name=''
    try{name=localStorage.getItem('crossline.callsign') ?? ''}catch{}
    let joined: ArenaSession
    let onlineRoom: Room<ArenaState> | undefined
    if(isOnline.value) {
      let token: string | null = null
      try { token=sessionStorage.getItem('crossline.ffa.reconnect'); name=localStorage.getItem('crossline.callsign') ?? '' } catch {}
      async function joinArena(){
        const info=await $fetch<{roomId:string|null;full:boolean;capacity:number;seats:number}>('/api/arena')
        if(info.full)throw Object.assign(new Error('Arena full'),{code:4213})
        const joinToken=await onlineJoinToken()
        try{return info.roomId?await client.joinById<ArenaState>(info.roomId,{joinToken}):await client.joinOrCreate<ArenaState>('ffa',{joinToken})}
        catch(error){
          const current=await $fetch<{roomId:string|null;full:boolean;capacity:number;seats:number}>('/api/arena')
          if(current.full)throw Object.assign(new Error('Arena full'),{code:4213})
          if(!info.roomId && current.roomId)return client.joinById<ArenaState>(current.roomId,{joinToken:await onlineJoinToken()})
          throw error
        }
      }
      try { joined=token ? await client.reconnect<ArenaState>(token) : await joinArena() }
      catch { joined=await joinArena() }
      onlineRoom=joined as Room<ArenaState>
      Object.assign(onlineRoom.reconnection,{enabled:true,minUptime:0,minDelay:300,maxDelay:2000,maxRetries:12})
      try { sessionStorage.setItem('crossline.ffa.reconnect',onlineRoom!.reconnectionToken) } catch {}
      roomCode.value=joined.roomId
    } else joined = localSession(isCampaign.value ? 'campaign' : isSolo.value ? 'solo' : 'training',name,isCampaign.value ? readCampaignProgress(mission.value.id) : undefined)
    if (stopped) {
      await joined.leave()
      return
    }
    room = joined
    status.value = 'Connected'
    if(isOnline.value){
      room.onMessage('authenticated',()=>{status.value='Connected'})
      room.onMessage('session-ended',()=>{joinError.value='Your session ended. Return to the menu and sign in again.';release();onlinePaused.value=true;phase.value='paused'})
      room.onMessage('leaderboard',(board:Leaderboard)=>{leaders.value=board;leadersUnavailable.value=false})
      room.onMessage('leaderboard-status',()=>{leadersUnavailable.value=true})
      room.send('leaderboard');void onlineJoinToken().then(token=>joined.send('authenticate',token)).catch(()=>{joinError.value='Sign in again to enter Online.';void joined.leave()})
    }
    room.onStateChange((state) => {
      if (state.round !== round.value) {
        visuals.reset()
        audio.stop()
        incoming.value=[]; elimination.value=undefined; eliminatedBy.value=undefined
        hitUntil.value=0; damageUntil.value=0; healUntil.value=0; feed.value=[]
      }
      if (state.campaign) {
        campaign.value = state.campaign
        missionVisuals?.sync(state.campaign)
        const serialized = JSON.stringify(state.campaign.save)
        if (serialized !== lastCampaignSave) { checkpointSaved.value = saveCampaignProgress(state.campaign.save); lastCampaignSave = serialized }
      }
      const liveGrenades:PlayerGrenade[]=[];state.grenades?.forEach(g=>liveGrenades.push({...g}))
      grenadeVisuals.sync(liveGrenades,state.campaign?.grenades??[],self.value)
      confirmedPhase.value = state.phase
      const nextPhase = state.phase==='finished' ? 'finished' : isOnline.value ? !onlineEntered.value ? 'ready' : onlinePaused.value ? 'paused' : state.phase : locallyPaused ? 'paused' : state.phase
      const phaseChanged = phase.value !== nextPhase
      if (phaseChanged) menuIndex.value = 0
      phase.value = nextPhase
      onlineCapacity.value=state.capacity ?? ONLINE_CAPACITY_TARGET
      const availablePacks:HealthPickup[]=[]
      state.healthPacks?.forEach(pack=>availablePacks.push({...pack}))
      packs.value=availablePacks
      supplies?.sync(availablePacks,state.elapsed)
      elapsed.value = state.elapsed
      duration.value = state.duration
      round.value = state.round
      const values: Combatant[] = []
      state.actors.forEach((a) => values.push({ ...a }))
      actors.value = values
      self.value = values.find((a) => a.id === joined.sessionId)
      if(self.value && pendingLaunch)launchEntry()
      if(!isCampaign.value && state.phase==='finished' && recordedRound!==`${joined.roomId}/${state.round}`){
        recordedRound=`${joined.roomId}/${state.round}`
        const score=self.value?.score ?? 0
        newBest.value=score>personalBest.value
        personalBest.value=Math.max(personalBest.value,score)
        try{localStorage.setItem(`crossline.best.${props.mode}`,String(personalBest.value))}catch{}
      }
      const player = self.value
      if (player) {
        weaponFeedback.sync(player)
        if(isOnline.value){
          networkHealth.acknowledge(player.inputSeq??0,performance.now())
          if(networkStalled.value && networkHealth.state(performance.now())!=='stalled'){networkStalled.value=false;networkNotice.value='Connection restored. Resume when ready.'}
        }
        prediction.reconcile(player,state.round,active.value)
        cameraTarget.set(player.x, player.y + stanceEye(player), player.z)
        if (
          Math.hypot(
            camera.position.x - cameraTarget.x,
            camera.position.y - cameraTarget.y,
            camera.position.z - cameraTarget.z,
          ) > 3
        )
          camera.position.copyFrom(cameraTarget)
        position.value = `${player.x.toFixed(1)} / ${player.z.toFixed(1)}`
        altitude.value = player.y.toFixed(1)
        const building = world.value.buildings.find(
          (b) => Math.abs(player.x - b.x) < b.width / 2 && Math.abs(player.z - b.z) < b.depth / 2,
        )
        const district = isCampaign.value ? mission.value.world.name : props.mode !== 'training' ? [...COMBAT_DISTRICTS].sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0]?.name : 'MERCER STREET'
        area.value = building ? player.y>=(building.height ?? 4.1)-.2 ? 'ROOFTOPS' : `${building.name}${building.height ? ` / LEVEL ${Math.floor(player.y/3.2)+1}` : ''}` : player.y>3.8 ? 'UPPER WALKWAY' : district ?? 'MERCER STREET'
      }
      labels?.sync(values.filter(a=>a.id!==joined.sessionId))
      visuals.sync(isOnline.value ? values.filter(a=>a.id !== joined.sessionId) : values)
      // Repeated snapshots from the previous pause/result screen must not undo a new Start.
      if (phaseChanged && (state.phase === 'finished' || state.phase === 'paused')) release()
    })
    room.onMessage('event', (event: GameEvent) => {
      if(event.type==='grenade-thrown'){if(event.sourceId===joined.sessionId)grenadeVisuals.thrown()}
      else if (event.type === 'explosion') {
        grenadeVisuals.explosion(event.position)
        audio.sound('explosion', false, event.position, self.value, look.yaw)
      } else if (event.type === 'shot') {
        const own = event.shooterId === joined.sessionId
        visuals.shot(event, own, !own)
        if(!own)audio.sound('shot', false, event.start, self.value, look.yaw)
        if (own) {
          if (event.damage) {
            hitUntil.value = performance.now() + (event.eliminated ? 420 : 260)
            hitHeadshot.value = event.headshot
            hitKill.value = event.eliminated
            audio.sound('hit')
          }
        }
      } else if (event.type === 'damage' && event.targetId === joined.sessionId) {
        damageUntil.value = performance.now() + 220
        const source = actors.value.find(actor => actor.id === event.sourceId)
        const bearing = self.value && source ? attackBearing(self.value, source) : undefined
        if (bearing !== undefined) incoming.value = [
          { source: event.sourceId, bearing, until: performance.now() + 1100 },
          ...incoming.value.filter(item => item.source !== event.sourceId && item.until > performance.now()),
        ].slice(0, 4)
        if (event.health === 0) audio.sound('death')
      } else if (event.type === 'heal' && event.targetId === joined.sessionId) {
        healAmount.value=event.amount;healUntil.value=performance.now()+2200;audio.sound('heal')
      } else if (event.type === 'spawn' && event.actorId === joined.sessionId) {
        crouchToggle.value=false
        incoming.value=[]; elimination.value=undefined; hitUntil.value=0; eliminatedBy.value=undefined
        prediction.reset();weaponFeedback.reset();stairCamera.reset()
        Object.assign(look, { yaw: event.yaw, pitch: 0 })
        clearInput()
      } else if (event.type === 'kill') {
        if (event.victimId === joined.sessionId) eliminatedBy.value = event.killer
        if (event.killerId === joined.sessionId) elimination.value = { name: event.victim, until: performance.now() + 1800 }
        feed.value = [
          { text: `${event.killer}  ›  ${event.victim}`, until: performance.now() + 5000 },
          ...feed.value,
        ].slice(0, 4)
      }
    })
    room.onDrop(() => {
      if(!isOnline.value || stopped)return
      networkStalled.value=true;networkNotice.value='Connection lost. Reconnecting; your character remains vulnerable.'
      status.value='Reconnecting'; onlinePaused.value=true; phase.value='paused'; release()
    })
    room.onReconnect(() => {
      if(stopped)return
      if(isOnline.value)void onlineJoinToken().then(token=>joined.send('authenticate',token)).catch(()=>{joinError.value='Sign in again to reconnect.';void joined.leave()})
      networkHealth.reset(performance.now());networkStalled.value=false;networkNotice.value='Connection restored. Resume when ready.'
      status.value='Connected'; onlinePaused.value=true; phase.value=onlineEntered.value ? 'paused' : 'ready'
      // The SDK rotates its token immediately after invoking onReconnect.
      queueMicrotask(() => { try { sessionStorage.setItem('crossline.ffa.reconnect',onlineRoom!.reconnectionToken) } catch {} })
      clearInput()
    })
    room.onLeave(() => {
      if (stopped) return
      if(isOnline.value)try { sessionStorage.removeItem('crossline.ffa.reconnect') } catch {}
      status.value = 'Disconnected'
      clearInterval(timer)
      release()
    })
    room.onError(() => {
      if(isOnline.value && onlineRoom?.reconnection.isReconnecting)return
      status.value = 'Connection error'
      release()
    })
    timer = setInterval(() => {
      if(status.value !== 'Connected')return
      const buffered=(onlineRoom?.connection.transport as {ws?:{bufferedAmount:number}}|undefined)?.ws?.bufferedAmount??0
      if(isOnline.value && onlineEntered.value){
        const health=networkHealth.state(performance.now(),buffered)
        if(health==='stalled'&&!networkStalled.value){
          networkStalled.value=true;networkNotice.value='Connection interrupted. Controls paused; your character remains vulnerable.'
          onlinePaused.value=true;phase.value='paused';release();prediction.reset(self.value);weaponFeedback.reset()
        }else if(!networkStalled.value&&phase.value==='playing')networkNotice.value=health==='weak'?'Weak connection — hits await server confirmation.':''
      }
      // Drop samples instead of growing a socket backlog. Recovery sends current neutral input.
      if(buffered>8192)return
      const input=readInput()
      lastInputFrame=performance.now()
      const seq=++inputSequence
      joined.send('input',{...input,seq,...(isOnline.value?{observedElapsed:elapsed.value}:{})})
      if(isOnline.value)networkHealth.command(seq,performance.now())
      if(active.value && self.value && self.value.health>0)prediction.command(seq,input)
    }, TICK_MS)
  } catch (error) {
    const code=error && typeof error==='object' && 'code' in error ? error.code : undefined
    joinError.value=(code===4213||code===409)?'Arena is full. Wait for a free seat, then retry.':code===4214?'Sign in with your account to enter Online.':code===4215?'This account is already in the arena. Leave its other session or reconnect.':isOnline.value?'The arena could not connect. Check your connection and retry.':'Game assets unavailable. Connect and download offline play from the menu, then retry.'
    console.error('Arena initialization failed',typeof code==='number'?code:'unavailable')
    status.value = 'Arena unavailable'
    release()
  }
})
onBeforeUnmount(() => {
  stopped = true
  clearInterval(timer)
  release()
  if(isOnline.value)try { sessionStorage.removeItem('crossline.ffa.reconnect') } catch {}
  void room?.leave()
  engine?.dispose()
  audio.dispose()
  document.removeEventListener('mousemove', mouseLook)
  document.removeEventListener('mousedown', mouseDown)
  document.removeEventListener('mouseup', mouseUp)
  document.removeEventListener('pointerlockchange', pointerChange)
  document.removeEventListener('visibilitychange', hidden)
  window.removeEventListener('keydown', keydown)
  window.removeEventListener('keyup', keyup)
  window.removeEventListener('blur', pause)
  window.removeEventListener('gamepaddisconnected', gamepadDisconnected)
  stopViewport.value?.()
})
</script>

<template>
  <main :data-client-position="clientPosition" :data-feedback-shots="feedbackShots" :data-network-stalled="networkStalled" :style="touchDevice && viewport.width ? {width: viewport.width+'px', height: viewport.height+'px'} : undefined" class="arena" :class="{ 'touch-layout': touchDevice }" :data-phase="phase" :data-server-phase="confirmedPhase" :data-mode="mode" :data-room-id="roomCode" :data-player-id="self?.id" :data-crouch="self?.crouch ?? 0" :data-eye-height="self ? stanceEye(self) : 1.6">
    <p v-if="networkNotice" class="network-notice" role="status" data-testid="network-notice">{{ networkNotice }}</p>
    <canvas ref="canvas" :aria-label="`Crossline ${modeTitle} arena`" @contextmenu.prevent />
    <div v-if="touchDevice && portrait" class="rotate-phone" role="dialog" aria-modal="true" aria-label="Rotate phone">
      <div><span class="rotate-icon" aria-hidden="true">↻</span><h1>Turn your phone sideways.</h1><p>Crossline uses landscape controls. Rotate your device to continue.</p><NuxtLink to="/">Return to menu</NuxtLink></div>
    </div>
    <div v-if="self && active && !touchDevice" class="grenade-inventory" aria-label="Grenade inventory" data-testid="grenade-count">{{ self.grenades??0 }} GRENADES <span>{{ padActive?'RB / R1':'G' }}</span></div>
    <TouchControls v-if="touchDevice && active" :crouched="(self?.crouch ?? 0)>.5" :grenades="self?.grenades??0" @grenade="throwGrenade" @move="touchMove" @look="touchLook" @fire="touchFire" @aim="touchAim" @reload="reload" @crouch="crouchToggle=!crouchToggle" @pause="pause" />
    <CampaignHud v-if="isCampaign && campaign && active" :state="campaign" :player="self" :touch="touchDevice" :heading="heading" :saved="checkpointSaved" :waypoints="waypoints" />
    <header>
      <NuxtLink to="/" class="brand">CROSSLINE<span>+</span></NuxtLink>
      <div class="location">
        {{ world.name }}<small>{{ area }}</small>
      </div>
      <div class="timer" data-testid="timer">
        {{ time }}<small>{{ modeTitle.toUpperCase() }} / {{ isCampaign ? `CHAPTER ${mission.chapter} / ${mission.kind.toUpperCase()}` : isOnline ? 'SHARED ARENA' : `ROUND ${round}` }}</small>
      </div>
    </header>
    <button v-if="isOnline" class="leaderboard-launch" @click="openLeaders">LEADERBOARD <span v-if="!touchDevice">· TAB / VIEW / SHARE</span></button>
    <section v-if="showLeaders" class="leaderboard-dialog" role="dialog" aria-modal="true" aria-label="Arena leaders">
      <div><LeaderboardPanel :board="leaders" :unavailable="leadersUnavailable" /><button class="leaderboard-close" @click="showLeaders=false">{{ touchDevice ? 'BACK' : 'BACK · ESC / B / ○' }}</button></div>
    </section>
    <aside class="radar-panel">
      <svg :viewBox="radarBox" :aria-label="`${modeTitle} radar`" class="radar">
        <rect :x="-world.limit-1" :y="-world.limit-1" :width="world.limit*2+2" :height="world.limit*2+2" fill="#151c22" />
        <path v-for="c in world.roadCenters" :key="c" :d="`M${-world.limit} ${-c}H${world.limit}M${c} ${-world.limit}V${world.limit}`" stroke="#303d45" stroke-width="6" />
        <rect
          v-for="b in world.buildings"
          :key="b.id"
          :x="b.x - b.width / 2"
          :y="-b.z - b.depth / 2"
          :width="b.width"
          :height="b.depth"
          fill="#596269" stroke="#9ca6ac" stroke-width=".3"
        />
        <rect v-for="p in packs" :key="p.id" :x="p.x-1.6" :y="-p.z-1.6" width="3.2" height="3.2" :fill="p.availableAt<=elapsed ? '#80ffc2' : '#53675d'"
          :data-pack="p.id" :data-ready="p.availableAt<=elapsed" :data-x="p.x" :data-z="p.z" :data-available-at="p.availableAt"><title>{{ p.availableAt<=elapsed ? '+35 HP' : 'Health pack cooling down' }}</title></rect>
        <circle v-if="campaign" :cx="campaignObjective.position.x" :cy="-campaignObjective.position.z" r="2" fill="#ffd090"><title>Mission objective</title></circle>
        <circle v-if="campaign && mission.kind === 'extraction'" :cx="campaign.captive.x" :cy="-campaign.captive.z" r="1.5" fill="#92e6ce"><title>{{ mission.companion }}</title></circle>
        <circle
          v-for="a in actors"
          :key="a.id"
          :cx="a.x"
          :cy="-a.z"
          :r="a.bot ? 1.1 : 1.4"
          :fill="a.id === self?.id ? '#d9ff9c' : '#ff9460'"
          :opacity="a.id === self?.id ? 0 : a.health > 0 ? 1 : 0"
          :data-actor="a.id"
          :data-x="a.x"
          :data-y="a.y"
          :data-z="a.z"
          :data-health="a.health"
        >
          <title>{{ a.name }}</title>
        </circle>
        <path v-if="self" d="M0 -2.8L1.9 1.8 0 1 -1.9 1.8Z" :transform="`translate(${self.x} ${-self.z}) rotate(${heading})`" fill="#fff4de" stroke="#151c22" stroke-width=".6" />
      </svg>
      <span class="radar-north" aria-hidden="true">N</span><span class="radar-range">{{ radarRadius * 2 }} m</span>
      <small class="diagnostics">{{ isOnline ? status : status === 'Connected' ? 'Connected · ON DEVICE' : status }} · {{ isOnline ? `${actors.length} / ${onlineCapacity} PLAYERS` : isCampaign ? 'CAMPAIGN / LOCAL' : isSolo ? `${COMBAT_BOT_COUNT} COMBAT BOTS` : '3 TARGETS · 2 PATROLS' }}</small>
    </aside>
    <div v-if="mode !== 'training' && healUntil>now" class="health-feedback" role="status" data-testid="health-feedback">+{{ healAmount }} HP · SUPPLIES COLLECTED</div>
    <div class="kill-feed">
      <p v-for="item in feed.filter((f) => f.until > now)" :key="item.until + item.text">
        {{ item.text }}
      </p>
    </div>
    <div
      v-if="active && self && self.health > 0"
      class="crosshair"
      :data-target="targetId ?? ''"
      :class="{ target: Boolean(targetId), hit: hitUntil > now, kill: hitKill && hitUntil > now }"
    >
      {{ hitUntil > now ? '×' : '+' }}
    </div>
    <div v-if="isOnline && targetId && active" class="target-name">{{ actors.find(a=>a.id===targetId)?.name }}</div>
    <div v-if="active && self && self.health > 0" class="damage-directions" aria-hidden="true">
      <div v-for="item in incoming.filter(item => item.until > now)" :key="item.source" class="damage-direction" :style="{ transform: `rotate(${relativeBearing(item.bearing, heading)}deg)` }"><i /></div>
    </div>
    <div v-if="active && hitUntil > now && hitHeadshot" class="hit-caption">Headshot</div>
    <Transition name="elimination"><div v-if="active && elimination && elimination.until > now" :key="elimination.until" class="elimination-confirmation" role="status"><span>Eliminated</span> {{ elimination.name }}</div></Transition>
    <div v-if="damageUntil > now" class="damage-flash" />
    <RespawnOverlay v-if="!isCampaign && phase === 'playing' && self && self.health <= 0" :remaining-ms="self.respawnUntil - elapsed" :duration-ms="TRAINING.respawnMs" :killer="eliminatedBy" />
    <section v-if="!active && (phase !== 'playing' || status !== 'Connected')" class="overlay">
      <div class="menu-card">
        <span class="eyebrow">{{
          phase === 'finished'
            ? isCampaign ? campaign?.outcome === 'success' ? 'OPERATION COMPLETE' : 'OPERATION FAILED' : 'SESSION COMPLETE'
            : phase === 'paused'
              ? 'TAKE A BREATHER'
              : `${world.name} / ${isOnline ? 'SHARED ARENA' : isCampaign ? `CHAPTER ${mission.chapter}` : isSolo ? 'SOLO MATCH' : 'LIVE PRACTICE'}`
        }}</span>
        <h1>
          {{
            phase === 'finished'
              ? isCampaign ? campaign?.outcome === 'success' ? mission.successTitle : 'Contact lost.' : `${modeTitle} complete.`
              : phase === 'paused'
                ? isOnline ? 'Match continues.' : `${modeTitle} paused.`
                : isCampaign ? mission.title + '.' : isOnline ? 'Join the free-for-all.' : isSolo ? 'Every angle is live.' : 'Learn the block.'
          }}
        </h1>
        <p v-if="phase === 'ready'">
          {{ isCampaign ? mission.briefing : isOnline ? 'Human players only. One ongoing arena. Quick respawns. Join friends on the same match server.' : isSolo ? 'Five minutes. Twelve bots targeting you. Use cover and crouch. Walk over green supply cases for +35 HP; they return after 25 seconds. Health does not regenerate in Solo.' : 'Three minutes. Five unarmed targets. Find your aim.' }}
        </p>
        <p v-if="isCampaign && phase === 'ready'" class="controls">{{ campaign ? campaignObjective.instruction : '' }}<br />Enter the objective circle to interact automatically.</p>
        <p v-if="isCampaign && phase === 'finished'" role="status">{{ campaign?.outcome === 'success' ? mission.debrief : (campaign?.radio ?? 'Your last checkpoint is ready. Retry to continue the operation.') }}</p>
        <p v-if="isCampaign && !checkpointSaved" role="status">Device storage unavailable. Progress is available for this session only.</p>
        <p v-if="phase === 'paused'">
          {{ isOnline ? 'Your controls are paused. The shared match continues and your character stays vulnerable.' : 'The whole session is paused. Your timer and opponents will wait.' }}
        </p>
        <p v-if="isOnline" class="controls" data-testid="online-session">{{ self?.name }} · ROOM {{ roomCode }} · {{ actors.length }} / {{ onlineCapacity }} PLAYERS</p>
        <p v-if="isOnline && status === 'Reconnecting'" role="status">Connection lost. Reconnecting for up to 20 seconds…</p>
        <div v-if="phase === 'finished'" class="results" data-testid="results">
          <div>
            <strong>{{ self?.score ?? 0 }}</strong
            >SCORE
          </div>
          <div>
            <strong>{{ self?.kills ?? 0 }} / {{ self?.deaths ?? 0 }}</strong
            >K / D
          </div>
          <div>
            <strong>{{ accuracy }}%</strong>ACCURACY
          </div>
          <div>
            <strong>{{ self?.headshots ?? 0 }}</strong
            >HEAD HITS
          </div>
        </div>
        <p v-if="!isCampaign && phase === 'finished'" data-testid="personal-best">{{ newBest ? 'NEW PERSONAL BEST' : 'PERSONAL BEST' }} · {{ personalBest }} POINTS <small>ON THIS DEVICE</small></p>
        <ol v-if="isOnline" class="match-standings my-5 space-y-2 text-sm" aria-label="Match standings">
          <li v-for="(actor, index) in [...actors].sort((a,b) => b.score-a.score)" :key="actor.id" class="flex justify-between border-b border-white/10 py-1" :class="{ 'text-[#d9ff9c]': actor.id === self?.id }">
            <span>{{ index + 1 }} · {{ actor.name }}{{ actor.connected === false ? ' · RECONNECTING' : actor.participating === false ? ' · LOBBY' : '' }}</span><span>{{ actor.kills }} K / {{ actor.deaths }} D · {{ actor.score }}</span>
          </li>
        </ol>
        <p v-if="joinError" role="alert">{{ joinError }}</p>
        <div class="menu-actions">
          <button
            v-for="(label, i) in menuItems"
            :key="label"
            :class="{ selected: menuIndex === i, primary: i === 0 }"
            :disabled="(status !== 'Connected' || !self) && label !== 'Return to menu'"
            @mousemove="menuIndex = i"
            @click="choose(i)"
          >
            {{ label }} <span aria-hidden="true">↗</span>
          </button>
        </div>
        <button
          v-if="
            status === 'Disconnected' ||
            status === 'Connection error' ||
            status === 'Arena unavailable'
          "
          class="reconnect"
          @click="reloadNuxtApp()"
        >
          Reload and reconnect
        </button>
        <p v-if="captureError" role="alert">{{ captureError }}</p>
        <button class="controls-toggle" @click="showControls = !showControls">{{ showControls ? 'Hide controls' : 'Controls' }}</button>
        <p v-if="showControls && touchDevice" class="controls">Left stick moves · Swipe the right side to look · Hold FIRE · AIM toggles sights · RELOAD · CROUCH · Ⅱ pauses</p>
        <p v-if="showControls && !touchDevice" class="controls">
          WASD move · Mouse look · Left click fire · Right click aim<br />R reload · G grenade · Esc pause ·
          {{ mode !== 'training' ? 'Walk over green cases for +35 HP · C toggles crouch · Ctrl holds crouch' : 'Practice health regenerates after cover · C toggles crouch · Ctrl holds crouch' }}
        </p>
        <p v-if="showControls && !touchDevice" class="controls">
          Controller: sticks move/look · A / × or RT / R2 fire · LT / L2 aim · X / □ reload · RB / R1 grenade<br />A / × select · Start
          or B / ○ pause/back · D-pad navigate · Right-stick click toggles crouch
        </p>
        <TouchSettings v-if="showControls && touchDevice" />
        <small v-if="!touchDevice" data-testid="gamepad-status">{{ padStatus }}</small>
        <div v-if="showControls && padReady && !touchDevice" class="mt-3 space-y-2 text-xs">
          <p data-testid="trigger-status">FIRE · {{ fireLabel }} · {{ Math.round(triggerLevel * 100) }}%</p>
          <button class="audio-toggle" @click="bindFire">{{ bindingFire ? 'Press your fire trigger…' : 'Assign fire trigger' }}</button>
          <button v-if="bindingFire" class="audio-toggle" @click="bindingFire = false">Cancel</button>
        </div>
        <button class="audio-toggle" @click="toggleAudio">Sound {{ muted ? 'off' : 'on' }}</button>
      </div>
    </section>
    <footer :class="{ 'touch-menu-hidden': touchDevice && !active }">
      <div class="health" :class="{ critical: (self?.health ?? 100)<=30 }">
        <small>HEALTH</small
        ><strong data-testid="health">{{ Math.ceil(self?.health ?? 100) }}<span> / 100 HP</span></strong>
        <div class="health-bar" role="progressbar" aria-label="Health" :aria-valuenow="Math.ceil(self?.health ?? 100)" :aria-valuemin="0" :aria-valuemax="100"><i :style="{ width: `${self?.health ?? 100}%` }" /></div>
        <small v-if="self && self.protectedUntil > elapsed && phase === 'playing'"
          >SPAWN PROTECTION</small
        >
      </div>
      <div class="score">
        <strong data-testid="score">{{ self?.score ?? 0 }}</strong
        ><small>{{ self?.kills ?? 0 }} ELIMINATIONS / {{ self?.deaths ?? 0 }} DEATHS</small>
      </div>
      <div class="ammo">
        <small>{{ RIFLE.name }}</small
        ><strong data-testid="ammo">{{ self?.ammo ?? 24 }}<span> / ∞</span></strong
        ><small v-if="reloadLeft > 0">RELOADING {{ (reloadLeft / 1000).toFixed(1) }}s</small
        ><small v-else-if="self?.ammo === 0">{{ touchDevice ? 'TAP RELOAD' : 'R / X TO RELOAD' }}</small
        ><small v-else>{{ touchDevice ? 'TOUCH RELOAD' : padActive ? 'A / × OR RT FIRE · X / □ RELOAD' : 'R RELOAD' }}</small>
      </div>
    </footer>
    <div class="telemetry diagnostics" aria-hidden="true">
      <span v-if="padReady && !touchDevice" data-testid="active-controller">{{ padActive ? 'CONTROLLER ACTIVE' : 'CONTROLLER READY · MOVE A STICK TO USE' }}</span>
      <span v-if="!touchDevice" data-testid="stance">{{ (self?.crouch ?? 0)>.5 ? 'CROUCHED' : 'STANDING' }} · C / CTRL / R3</span>
      <span v-if="isSolo" class="supplies-hint">GREEN SQUARES: +35 HP</span>
      <span data-testid="heading" :data-pitch="pitch.toFixed(4)"
        >LOOK {{ (Math.round(heading) % 360).toString().padStart(3, '0') }}°</span
      ><span data-testid="position">{{ position }}</span
      ><span
        >HEIGHT <span data-testid="altitude">{{ altitude }}</span> M</span
      >
    </div>
  </main>
</template>

<style scoped>
.arena{height:100dvh;min-height:500px;overflow:hidden;position:relative;background:var(--cl-bg);color:var(--cl-text);font-family:'Helvetica Neue',Arial,sans-serif;font-variant-numeric:tabular-nums}
.arena canvas{width:100%;height:100%;display:block;outline:none}
header{position:absolute;inset:0 0 auto;display:flex;justify-content:space-between;align-items:flex-start;padding:24px 32px;pointer-events:none;background:linear-gradient(#0b1013a6,transparent);text-shadow:0 2px 6px #0008}
.brand{font-size:25px;font-weight:900;letter-spacing:-1.5px;pointer-events:auto}.brand span{color:var(--cl-accent)}
.location{text-align:center;font-size:12px;font-weight:600}.location small,.timer small{display:block;font-size:10px;font-weight:500;margin-top:6px;color:#e0e2dd;letter-spacing:.03em}
.timer{text-align:right;font-size:32px;font-weight:600;line-height:1}
.radar-panel{position:absolute;left:32px;top:86px;width:156px;filter:drop-shadow(0 4px 12px #0004);pointer-events:none}.radar{width:100%;display:block;border:1px solid #ffffff50;border-radius:8px;overflow:hidden;background:#151c22;opacity:.94}.radar-north{position:absolute;left:50%;top:4px;transform:translateX(-50%);color:var(--cl-accent);font-size:10px;font-weight:800;text-shadow:0 1px 3px #000}.radar-range{position:absolute;right:6px;bottom:5px;color:#cdd5d8;font-size:9px;padding:1px 4px;background:#111519b3;border-radius:3px}
.diagnostics{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip-path:inset(50%);white-space:nowrap;border:0!important;pointer-events:none}
.kill-feed{position:absolute;right:32px;top:146px;font-size:11px;text-align:right;pointer-events:none}.kill-feed p{background:#151b21c9;border-right:2px solid #ffbb7080;padding:7px 12px;margin-bottom:5px;border-radius:4px}
.crosshair{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font:28px monospace;color:#f5f2e9;pointer-events:none;text-shadow:0 1px 3px #000}.crosshair.target{color:#ff9d87}.crosshair.hit{font-size:38px;color:white}.crosshair.kill{color:var(--cl-accent)}
.hit-caption{position:absolute;top:calc(50% + 28px);left:50%;transform:translateX(-50%);font-size:10px;font-weight:700;color:var(--cl-accent);text-shadow:0 1px 4px #000;pointer-events:none}
.damage-flash{position:absolute;inset:0;box-shadow:inset 0 0 65px 12px #ac231c55;pointer-events:none}.damage-directions{position:absolute;inset:0;pointer-events:none}.damage-direction{position:absolute;left:calc(50% - 75px);top:calc(50% - 75px);width:150px;height:150px}.damage-direction i{position:absolute;top:0;left:48px;width:54px;height:18px;border-top:4px solid #ff806a;border-radius:50%;filter:drop-shadow(0 1px 3px #5b1717);animation:damage-in .12s ease-out}
.elimination-confirmation{position:absolute;top:calc(50% + 72px);left:50%;transform:translateX(-50%);background:#151b21dd;border:1px solid #ffbb7066;border-radius:5px;padding:9px 14px;color:var(--cl-text);font-size:12px;pointer-events:none;white-space:nowrap}.elimination-confirmation span{color:var(--cl-accent);font-weight:700;margin-right:6px}.elimination-enter-active,.elimination-leave-active{transition:opacity .18s,margin-top .18s}.elimination-enter-from,.elimination-leave-to{opacity:0;margin-top:5px}@keyframes damage-in{from{opacity:0}to{opacity:1}}
.overlay{position:absolute;inset:0;z-index:40;display:grid;place-items:center;background:#0b101366;backdrop-filter:blur(5px);padding:20px}
.menu-card{width:min(500px,94vw);max-height:calc(100dvh - 40px);overflow-y:auto;background:#191f24f5;border:1px solid var(--cl-line);border-top:3px solid var(--cl-accent);border-radius:10px;padding:28px;box-shadow:0 25px 80px #0006}.eyebrow{font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--cl-accent)}.menu-card h1{font-size:32px;font-weight:800;letter-spacing:-1.2px;line-height:1.05;margin:12px 0}.menu-card p{font-size:13px;line-height:1.6;color:var(--cl-muted)}
.menu-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:22px 0 12px}.menu-actions button{display:flex;justify-content:space-between;align-items:center;gap:12px;text-align:left;border:1px solid var(--cl-line);border-radius:5px;padding:12px 14px;font-size:12px;font-weight:600;min-height:44px;background:#ffffff05}.menu-actions button.primary{grid-column:1/-1;background:var(--cl-accent);color:#17191c;border-color:var(--cl-accent);font-size:14px}.menu-actions button:last-child:nth-child(2){grid-column:1/-1}.menu-actions button.selected:not(.primary),.menu-actions button:hover:not(.primary){border-color:var(--cl-accent);background:#ffbb7015}.menu-actions button:disabled{opacity:.4;cursor:wait}.menu-actions button span{font-size:18px}.menu-card p.controls{font-size:12px;margin-top:12px;line-height:1.65}.menu-card>small{display:block;font-size:11px;color:var(--cl-muted);margin-top:12px}.controls-toggle{background:var(--cl-accent);color:#17191c;border:1px solid var(--cl-accent);border-radius:4px;padding:8px 14px;font-size:11px;font-weight:700;min-height:40px;margin:12px 20px 0 0}.controls-toggle:hover{filter:brightness(1.1)}.audio-toggle{font-size:11px;color:var(--cl-muted);text-decoration:underline;text-underline-offset:4px;margin:12px 20px 0 0;min-height:30px}.reconnect{display:block;margin:16px 0 12px;padding:10px 14px;border:1px solid var(--cl-accent);background:var(--cl-panel);color:var(--cl-accent);font-size:12px}
.results{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:22px 0 16px;font-size:9px;font-weight:600;color:var(--cl-muted)}.results>div{background:#ffffff05;border:1px solid var(--cl-line);border-radius:6px;padding:12px 8px}.results strong{display:block;font-size:24px;font-weight:700;color:var(--cl-text);margin-bottom:6px}.menu-card [data-testid=personal-best]{font-size:11px;color:var(--cl-accent)}.menu-card [data-testid=personal-best] small{display:block;color:var(--cl-muted);font-size:9px;margin-top:2px}.match-standings{max-height:130px;overflow:auto}
footer{position:absolute;inset:auto 0 0;display:flex;justify-content:space-between;align-items:flex-end;padding:36px 32px 24px;pointer-events:none;background:linear-gradient(transparent,#0b1013c9);text-shadow:0 1px 4px #0006}footer small{display:block;font-size:10px;font-weight:600;letter-spacing:.04em;color:#d0d6d8}footer strong{font-size:54px;font-weight:650;letter-spacing:-.04em;line-height:1.12}footer strong span{font-size:16px;font-weight:400;letter-spacing:0;color:#c8d0d2}.health{width:180px}.health-bar{height:5px;background:#ffffff33;border-radius:4px;margin:8px 0 0;overflow:hidden}.health-bar i{display:block;height:100%;background:var(--cl-text);transition:width .15s}.health.critical strong{color:#ff806a}.health.critical .health-bar i{background:#ff806a}.ammo{text-align:right}.score{text-align:center}.score strong{display:block;font-size:26px}.score small{font-size:10px;margin-top:4px}.health-feedback{position:absolute;top:25%;left:50%;transform:translateX(-50%);color:#a7ffcb;background:#17312ce8;padding:10px 16px;font-size:12px;border:1px solid #75d9a680;border-radius:5px;pointer-events:none}.target-name{position:absolute;top:calc(50% - 40px);left:50%;transform:translateX(-50%);color:var(--cl-accent);font-size:12px;pointer-events:none;text-shadow:0 1px 4px #000}
.network-notice{position:absolute;top:90px;left:50%;transform:translateX(-50%);z-index:50;background:#191f24ed;color:var(--cl-accent);padding:8px 12px;max-width:80vw;font:12px/1.4 Arial;pointer-events:none;border:1px solid var(--cl-line);border-radius:5px}
.leaderboard-launch{position:absolute;right:32px;top:98px;z-index:45;border:1px solid var(--cl-line);border-radius:5px;background:#191f24e8;padding:10px 12px;font-size:10px;color:var(--cl-text);pointer-events:auto}.leaderboard-launch span{color:var(--cl-muted);font-size:9px}.leaderboard-dialog{position:absolute;inset:0;z-index:60;background:#0b1013e8;display:grid;place-items:center;padding:24px}.leaderboard-dialog>div{width:min(720px,96vw);max-height:90dvh;overflow-y:auto;background:var(--cl-panel);border:1px solid var(--cl-line);border-top:3px solid var(--cl-accent);border-radius:8px;padding:24px}.leaderboard-close{display:block;width:100%;padding:12px;background:#ffffff15;margin-top:18px;font-size:12px;border-radius:5px}
.rotate-phone{position:fixed;inset:0;z-index:100;background:var(--cl-bg);display:grid;place-items:center;padding:28px;text-align:center;touch-action:manipulation}.rotate-phone h1{font-size:27px;margin:18px 0}.rotate-phone p{max-width:300px;line-height:1.6;color:var(--cl-muted);font-size:14px}.rotate-phone a{display:inline-block;margin-top:24px;color:var(--cl-accent);padding:12px}.rotate-icon{font-size:64px;color:var(--cl-accent)}
.touch-layout{min-height:0;touch-action:none;overscroll-behavior:none}.touch-layout header{padding:calc(10px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right)) 8px calc(12px + env(safe-area-inset-left));height:50px}.touch-layout .brand{font-size:20px}.touch-layout .location{display:none}.touch-layout .timer{font-size:24px}.touch-layout .timer small{font-size:8px;margin-top:4px}.touch-layout .radar-panel{top:54px;left:calc(12px + env(safe-area-inset-left));width:84px}.touch-layout .radar-north{font-size:8px;top:2px}.touch-layout .radar-range{font-size:7px;right:3px;bottom:3px}.touch-menu-hidden{visibility:hidden}.touch-layout footer{padding:22px calc(12px + env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left));gap:14px}.touch-layout footer strong{font-size:34px}.touch-layout footer strong span{font-size:11px}.touch-layout footer small{font-size:8px}.touch-layout .health{width:130px}.touch-layout .health-bar{margin-top:5px;height:4px}.touch-layout .score strong{font-size:23px}.touch-layout .score small{font-size:8px}.arena[data-mode=campaign] .kill-feed{display:none}.touch-layout .kill-feed{top:54px;right:calc(50% - 90px);font-size:9px;max-width:180px}.touch-layout .kill-feed p{padding:5px 8px}.touch-layout .health-feedback{top:20%;padding:8px 12px;font-size:11px}.touch-layout .overlay{padding:10px}.touch-layout .menu-card{width:min(500px,94vw);max-height:calc(100dvh - 20px);padding:18px 24px;touch-action:pan-y}.touch-layout .menu-card h1{font-size:26px;margin:8px 0}.touch-layout .menu-card p{font-size:11px;line-height:1.5}.touch-layout .menu-actions{margin-top:16px}.touch-layout .menu-actions button{min-height:40px;padding:10px 14px;font-size:11px}.touch-layout .results{margin:14px 0;gap:6px}.touch-layout .results>div{padding:10px 7px}.touch-layout .results strong{font-size:22px}.touch-layout .leaderboard-launch{top:54px;right:calc(12px + env(safe-area-inset-right));padding:8px;font-size:9px}.touch-layout .leaderboard-dialog{padding:10px}.touch-layout .leaderboard-dialog>div{padding:16px;max-height:94dvh}
@media(max-width:650px){.location{display:none}.menu-card h1{font-size:28px}.results strong{font-size:20px}}
@media(max-height:400px){.touch-layout .radar-panel{width:70px}.touch-layout .kill-feed p:nth-child(n+3){display:none}}
</style>

<style scoped>.grenade-inventory{position:absolute;right:32px;bottom:155px;color:#dae3d6;font:11px Arial;z-index:4}.grenade-inventory span{border:1px solid #ffffff55;border-radius:3px;padding:3px 6px;margin-left:7px}</style>
