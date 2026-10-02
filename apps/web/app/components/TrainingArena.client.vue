<script setup lang="ts">
import type { Engine } from '@babylonjs/core/Engines/engine'
import { Client, type Room } from '@colyseus/sdk'
import { ROOM_NAME, TICK_MS, readStick, TRAINING_WORLD, COMBAT_WORLD, COMBAT_DISTRICTS, COMBAT_BOT_COUNT } from '@crossline/shared'
import {
  RIFLE,
  EYE_HEIGHT,
  aimedTarget,
  direction,
  type Combatant,
  type GameEvent,
  type Phase,
  type GameMode,
} from '@crossline/shared/combat'
import { createUrbanScene } from '~/game/createUrbanScene'
import { loadTrainingAssets } from '~/game/trainingAssets'
import { combatPresentation, trainingAudio } from '~/game/combatPresentation'
import { rotateLook, MOUSE_SENSITIVITY } from '~/game/look'
import { selectController, controllerActivity, controllerButtons, controllerFire, loadFireBinding, DEFAULT_FIRE_BINDING, type FireBinding } from '~/game/controller'
const props = withDefaults(defineProps<{ mode?: GameMode }>(), { mode: 'training' })
const isOnline = computed(() => props.mode === 'online')
const onlineEntered = ref(false), onlinePaused = ref(false), onlineCapacity = ref(8), roomCode = ref('')
const isSolo = computed(() => props.mode === 'solo')
const world = computed(() => props.mode !== 'training' ? COMBAT_WORLD : TRAINING_WORLD)
const radarBox = computed(() => { const r=world.value.limit+2; return `${-r} ${-r} ${r*2} ${r*2}` })
const modeTitle = computed(() => isOnline.value ? 'Online Free-for-All' : isSolo.value ? 'Solo vs Bots' : 'Training')
const sessionWord = computed(() => props.mode !== 'training' ? 'match' : 'training')
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
interface ArenaState {
  actors: { forEach(callback: (actor: Combatant, id: string) => void): void }
  phase: Phase
  elapsed: number
  duration: number
  round: number
  capacity?: number
}
const canvas = ref<HTMLCanvasElement>(),
  status = ref('Connecting'),
  phase = ref<Phase>('ready'),
  confirmedPhase = ref<Phase>('ready'),
  elapsed = ref(0),
  duration = ref(180000),
  round = ref(1)
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
const targetId = ref<string>()
const hitUntil = ref(0),
  hitKill = ref(false),
  damageUntil = ref(0),
  now = ref(0),
  feed = ref<{ text: string; until: number }[]>([]),
  menuIndex = ref(0)
const look = { yaw: 0, pitch: 0 },
  keys = new Set<string>(),
  audio = trainingAudio(),
  config = useRuntimeConfig()
let engine: Engine | undefined,
  room: Room<ArenaState> | undefined,
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
    status.value === 'Connected' &&
    phase.value === 'playing' &&
    (captured.value || padActive.value),
)
const seconds = computed(() => Math.ceil(Math.max(0, duration.value - elapsed.value) / 1000))
const time = computed(
  () => isOnline.value ? '∞' : `${Math.floor(seconds.value / 60)}:${String(seconds.value % 60).padStart(2, '0')}`,
)
const accuracy = computed(() =>
  self.value?.shots ? Math.round((self.value.hits / self.value.shots) * 100) : 0,
)
const reloadLeft = computed(() => Math.max(0, (self.value?.reloadUntil ?? 0) - elapsed.value))
const menuItems = computed(() =>
  isOnline.value ? [onlineEntered.value ? 'Resume match' : 'Enter arena', 'Return to menu'] :
  phase.value === 'finished'
    ? ['Run it again', 'Return to menu']
    : phase.value === 'paused'
      ? [`Resume ${sessionWord.value}`, `Restart ${sessionWord.value}`, 'Finish session', 'Return to menu']
      : [`Start ${sessionWord.value}`, 'Return to menu'],
)
function action(value: string) {
  if(status.value === 'Connected')room?.send('action', value)
}
function clearInput() {
  keys.clear()
  mouseFire = false
  mouseAim = false
  padMovement = { x: 0, y: 0 }
  padFire = false
  padAim = false
  selectFireArmed = false
  if(status.value === 'Connected')room?.send('input', { x: 0, z: 0, ...look, fire: false, aim: false })
}
function release() {
  clearInput()
  padActive.value = false
  if (document.pointerLockElement === canvas.value) document.exitPointerLock()
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
  if (status.value !== 'Connected') return
  audio.unlock()
  captureError.value = ''
  if (usePad) {
    selectFireArmed = false
    padActive.value = true
    if(isOnline.value) { onlineEntered.value=true; onlinePaused.value=false; phase.value='playing' }
    action('start')
    return
  }
  try {
    await canvas.value?.requestPointerLock()
    if (document.pointerLockElement === canvas.value) {
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
  if (label === 'Return to menu') {
    void navigateTo('/')
    return
  }
  if (label === 'Finish session') {
    action('finish')
    release()
    return
  }
  if (label === `Restart ${sessionWord.value}` || label === 'Run it again') {
    action('restart')
    Object.assign(look, { yaw: 0, pitch: 0 })
    menuIndex.value = 0
    return
  }
  void start(usePad)
}
function toggleAudio() {
  muted.value = !muted.value
  audio.mute(muted.value)
}
function reload() {
  if (active.value && reloadLeft.value === 0 && self.value && self.value.ammo < RIFLE.magazine) {
    action('reload')
  }
}
function keydown(event: KeyboardEvent) {
  if (event.code === 'Escape') {
    event.preventDefault()
    if (showControls.value) { showControls.value = false; bindingFire.value = false; return }
    pause()
    return
  }
  if (active.value) {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'Space'].includes(event.code))
      event.preventDefault()
    keys.add(event.code)
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
const keyup = (event: KeyboardEvent) => keys.delete(event.code)
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
  captured.value = document.pointerLockElement === canvas.value
  if (!captured.value && !padActive.value && phase.value === 'playing') pause()
}
function hidden() {
  if (document.hidden) pause()
}
const resize = () => engine?.resize()
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
    if (phase.value === 'playing') {
      if (!pressed[0]) selectFireArmed = true
      if (!padActive.value && (controllerActivity(pad) || controllerFire(pad, fireBinding.value))) {
        const wasArmed = selectFireArmed
        clearInput()
        selectFireArmed = wasArmed
        padActive.value = true
        audio.unlock()
      }
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
      }
    } else {
      selectFireArmed = false
      if (edge(1)) {
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
  await nextTick()
  if (!canvas.value) return
  try {
    const arena = createUrbanScene(canvas.value, world.value)
    engine = arena.engine
    const { scene, camera } = arena
    const cameraTarget = camera.position.clone()
    status.value = 'Loading models'
    const [assets] = await Promise.all([loadTrainingAssets(scene), audio.prepare()])
    if (stopped) {
      scene.dispose()
      return
    }
    arena.addVehicles(assets)
    const visuals = combatPresentation(scene, camera, assets, arena.shadows, props.mode)
    await scene.whenReadyAsync()
    if (stopped) return
    engine.runRenderLoop(() => {
      const dt = Math.min(engine!.getDeltaTime(), 50) / 1000
      now.value = performance.now()
      pollPad(dt)
      for (const axis of ['x', 'y', 'z'] as const)
        camera.position[axis] +=
          (cameraTarget[axis] - camera.position[axis]) * (1 - Math.exp(-dt * 35))
      camera.rotation.set(look.pitch, look.yaw, 0)
      heading.value = ((((look.yaw * 180) / Math.PI) % 360) + 360) % 360
      pitch.value = look.pitch
      const viewer = self.value
      targetId.value =
        active.value && viewer && viewer.health > 0
          ? aimedTarget(
              { x: viewer.x, y: viewer.y + EYE_HEIGHT, z: viewer.z },
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
        active.value && (padActive.value ? padAim : mouseAim),
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
    window.addEventListener('resize', resize)
    const client = new Client(String(config.public.matchUrl))
    let joined: Room<ArenaState>
    if(isOnline.value) {
      let token: string | null = null, name = ''
      try { token=sessionStorage.getItem('crossline.ffa.reconnect'); name=localStorage.getItem('crossline.callsign') ?? '' } catch {}
      try { joined=token ? await client.reconnect<ArenaState>(token) : await client.joinOrCreate<ArenaState>('ffa',{name}) }
      catch { joined=await client.joinOrCreate<ArenaState>('ffa',{name}) }
      Object.assign(joined.reconnection,{enabled:true,minUptime:0,minDelay:300,maxDelay:2000,maxRetries:12})
      try { sessionStorage.setItem('crossline.ffa.reconnect',joined.reconnectionToken) } catch {}
      roomCode.value=joined.roomId
    } else joined = await client.create<ArenaState>(isSolo.value ? 'solo' : ROOM_NAME)
    if (stopped) {
      await joined.leave()
      return
    }
    room = joined
    status.value = 'Connected'
    room.onStateChange((state) => {
      if (state.round !== round.value) {
        visuals.reset()
        audio.stop()
      }
      confirmedPhase.value = state.phase
      const nextPhase = isOnline.value ? !onlineEntered.value ? 'ready' : onlinePaused.value ? 'paused' : state.phase : state.phase
      if (phase.value !== nextPhase) menuIndex.value = 0
      phase.value = nextPhase
      onlineCapacity.value=state.capacity ?? 8
      elapsed.value = state.elapsed
      duration.value = state.duration
      round.value = state.round
      const values: Combatant[] = []
      state.actors.forEach((a) => values.push({ ...a }))
      actors.value = values
      self.value = values.find((a) => a.id === joined.sessionId)
      const player = self.value
      if (player) {
        cameraTarget.set(player.x, player.y + EYE_HEIGHT, player.z)
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
        const district = props.mode !== 'training' ? [...COMBAT_DISTRICTS].sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0]?.name : 'MERCER STREET'
        area.value = player.y > 3.8 ? 'ROOFTOPS' : building ? building.name : district ?? 'MERCER STREET'
      }
      visuals.sync(isOnline.value ? values.filter(a=>a.id !== joined.sessionId) : values)
      if (state.phase === 'finished' || state.phase === 'paused') release()
    })
    room.onMessage('event', (event: GameEvent) => {
      if (event.type === 'shot') {
        const own = event.shooterId === joined.sessionId
        visuals.shot(event, own)
        audio.sound('shot', own, event.start, self.value, look.yaw)
        if (own) {
          Object.assign(look, rotateLook(look, 0, -0.012))
          if (event.damage) {
            hitUntil.value = performance.now() + 180
            hitKill.value = event.eliminated
            audio.sound('hit')
          }
        }
      } else if (event.type === 'damage' && event.targetId === joined.sessionId) {
        damageUntil.value = performance.now() + 220
        if (event.health === 0) audio.sound('death')
      } else if (event.type === 'spawn' && event.actorId === joined.sessionId) {
        Object.assign(look, { yaw: event.yaw, pitch: 0 })
        clearInput()
      } else if (event.type === 'kill') {
        feed.value = [
          { text: `${event.killer}  ›  ${event.victim}`, until: performance.now() + 5000 },
          ...feed.value,
        ].slice(0, 4)
      }
    })
    room.onDrop(() => {
      if(!isOnline.value || stopped)return
      status.value='Reconnecting'; onlinePaused.value=true; phase.value='paused'; release()
    })
    room.onReconnect(() => {
      if(stopped)return
      status.value='Connected'; onlinePaused.value=true; phase.value=onlineEntered.value ? 'paused' : 'ready'
      // The SDK rotates its token immediately after invoking onReconnect.
      queueMicrotask(() => { try { sessionStorage.setItem('crossline.ffa.reconnect',joined.reconnectionToken) } catch {} })
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
      if(isOnline.value && joined.reconnection.isReconnecting)return
      status.value = 'Connection error'
      release()
    })
    timer = setInterval(() => {
      if(status.value !== 'Connected')return
      const enabled = active.value,
        forward = enabled
          ? padActive.value
            ? -padMovement.y
            : Number(keys.has('KeyW')) - Number(keys.has('KeyS'))
          : 0,
        right = enabled
          ? padActive.value
            ? padMovement.x
            : Number(keys.has('KeyD')) - Number(keys.has('KeyA'))
          : 0,
        length = Math.max(1, Math.hypot(forward, right))
      joined.send('input', {
        x: (Math.sin(look.yaw) * forward + Math.cos(look.yaw) * right) / length,
        z: (Math.cos(look.yaw) * forward - Math.sin(look.yaw) * right) / length,
        ...look,
        fire: enabled && (padActive.value ? padFire : mouseFire),
        aim: enabled && (padActive.value ? padAim : mouseAim),
      })
    }, TICK_MS)
  } catch (error) {
    console.error('Training initialization failed', error)
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
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <main class="arena" :data-phase="phase" :data-server-phase="confirmedPhase" :data-mode="mode" :data-room-id="roomCode" :data-player-id="self?.id">
    <canvas ref="canvas" :aria-label="`Crossline ${modeTitle} arena`" @contextmenu.prevent />
    <header>
      <NuxtLink to="/" class="brand">CROSSLINE<span>+</span></NuxtLink>
      <div class="location">
        {{ world.name }}<small>{{ area }}</small>
      </div>
      <div class="timer" data-testid="timer">
        {{ time }}<small>{{ modeTitle.toUpperCase() }} / {{ isOnline ? 'CONTINUOUS' : `ROUND ${round}` }}</small>
      </div>
    </header>
    <aside class="radar-panel">
      <svg :viewBox="radarBox" :aria-label="`${modeTitle} radar`" class="radar">
        <rect :x="-world.limit-1" :y="-world.limit-1" :width="world.limit*2+2" :height="world.limit*2+2" fill="#1d2929" />
        <path v-for="c in world.roadCenters" :key="c" :d="`M${-world.limit} ${-c}H${world.limit}M${c} ${-world.limit}V${world.limit}`" stroke="#58615b" stroke-width="6" />
        <rect
          v-for="b in world.buildings"
          :key="b.id"
          :x="b.x - b.width / 2"
          :y="-b.z - b.depth / 2"
          :width="b.width"
          :height="b.depth"
          fill="#85887b"
        />
        <circle
          v-for="a in actors"
          :key="a.id"
          :cx="a.x"
          :cy="-a.z"
          :r="(a.bot ? .9 : 1.3) * (mode !== 'training' ? 2 : 1)"
          :fill="a.id === self?.id ? '#d9ff9c' : '#ff9460'"
          :opacity="a.health > 0 ? 1 : 0.2"
          :data-actor="a.id"
          :data-x="a.x"
          :data-y="a.y"
          :data-z="a.z"
          :data-health="a.health"
        >
          <title>{{ a.name }}</title>
        </circle></svg
      ><small>{{ status }} · {{ isOnline ? `${actors.length} / ${onlineCapacity} PLAYERS` : isSolo ? `${COMBAT_BOT_COUNT} COMBAT BOTS` : '3 TARGETS · 2 PATROLS' }}</small>
    </aside>
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
    <div v-if="damageUntil > now" class="damage-flash" />
    <div v-if="phase === 'playing' && self && self.health <= 0" class="death">
      <span>ELIMINATED</span>
      <h2>Back in {{ Math.max(1, Math.ceil((self.respawnUntil - elapsed) / 1000)) }}</h2>
      <p>New position. Fresh magazine. Keep moving.</p>
    </div>
    <section v-if="!active && (phase !== 'playing' || status !== 'Connected')" class="overlay">
      <div class="menu-card">
        <span class="eyebrow">{{
          phase === 'finished'
            ? 'SESSION COMPLETE'
            : phase === 'paused'
              ? 'TAKE A BREATHER'
              : `${world.name} / ${isSolo ? 'SOLO MATCH' : 'LIVE PRACTICE'}`
        }}</span>
        <h1>
          {{
            phase === 'finished'
              ? `${modeTitle} complete.`
              : phase === 'paused'
                ? isOnline ? 'Match continues.' : `${modeTitle} paused.`
                : isOnline ? 'Join the free-for-all.' : isSolo ? 'Every angle is live.' : 'Learn the block.'
          }}
        </h1>
        <p v-if="phase === 'ready'">
          {{ isOnline ? 'Human players only. Unlimited respawns. Continuous scoring until you leave. Open another client on this local server to play together.' : isSolo ? 'Three minutes. Twelve bots targeting you. They never attack each other. Keep moving, use cover, and fight back.' : 'Three minutes. Five unarmed targets. Find your aim.' }}
        </p>
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
        <ol v-if="(isSolo && phase === 'finished') || isOnline" class="my-5 space-y-2 text-sm" aria-label="Match standings">
          <li v-for="(actor, index) in [...actors].sort((a,b) => b.score-a.score)" :key="actor.id" class="flex justify-between border-b border-white/10 py-1" :class="{ 'text-[#d9ff9c]': actor.id === self?.id }">
            <span>{{ index + 1 }} · {{ actor.name }}{{ actor.connected === false ? ' · RECONNECTING' : actor.participating === false ? ' · LOBBY' : '' }}</span><span>{{ actor.kills }} K / {{ actor.deaths }} D · {{ actor.score }}</span>
          </li>
        </ol>
        <div class="menu-actions">
          <button
            v-for="(label, i) in menuItems"
            :key="label"
            :class="{ selected: menuIndex === i }"
            :disabled="status !== 'Connected' && label !== 'Return to menu'"
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
        <button class="audio-toggle" @click="showControls = !showControls">{{ showControls ? 'Hide controls' : 'Controls' }}</button>
        <p v-if="showControls" class="controls">
          WASD move · Mouse look · Left click fire · Right click aim<br />R reload · Esc pause ·
          Health regenerates after cover
        </p>
        <p v-if="showControls" class="controls">
          Controller: sticks move/look · A / × or RT / R2 fire · LT / L2 aim · X / □ reload<br />A / × select · Start
          or B / ○ pause/back · D-pad navigate
        </p>
        <small data-testid="gamepad-status">{{ padStatus }}</small>
        <div v-if="showControls && padReady" class="mt-3 space-y-2 text-xs">
          <p data-testid="trigger-status">FIRE · {{ fireLabel }} · {{ Math.round(triggerLevel * 100) }}%</p>
          <button class="audio-toggle" @click="bindFire">{{ bindingFire ? 'Press your fire trigger…' : 'Assign fire trigger' }}</button>
          <button v-if="bindingFire" class="audio-toggle" @click="bindingFire = false">Cancel</button>
        </div>
        <button class="audio-toggle" @click="toggleAudio">Sound {{ muted ? 'off' : 'on' }}</button>
      </div>
    </section>
    <footer>
      <div class="health">
        <small>VITALS</small
        ><strong data-testid="health">{{ Math.ceil(self?.health ?? 100) }}<span> HP</span></strong>
        <div class="health-bar"><i :style="{ width: `${self?.health ?? 100}%` }" /></div>
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
        ><small v-else-if="self?.ammo === 0">R / X TO RELOAD</small
        ><small v-else>{{ padActive ? 'A / × OR RT FIRE · X / □ RELOAD' : 'R RELOAD' }}</small>
      </div>
    </footer>
    <div class="telemetry">
      <span v-if="padReady" data-testid="active-controller">{{ padActive ? 'CONTROLLER ACTIVE' : 'CONTROLLER READY · MOVE A STICK TO USE' }}</span>
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
.arena {
  height: 100dvh;
  min-height: 500px;
  overflow: hidden;
  position: relative;
  background: #151d19;
  color: #eef2e6;
  font-family: Arial, sans-serif;
}
.arena canvas {
  width: 100%;
  height: 100%;
  display: block;
  outline: none;
}
header {
  position: absolute;
  inset: 0 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 25px 32px;
  background: linear-gradient(#101711b0, transparent);
  pointer-events: none;
}
.brand {
  font-size: 27px;
  font-weight: 900;
  letter-spacing: -1.5px;
  pointer-events: auto;
}
.brand span {
  color: #d9ff9c;
}
.location,
.timer {
  font: 12px monospace;
  letter-spacing: 2px;
  text-align: center;
}
.location small,
.timer small {
  display: block;
  font-size: 9px;
  letter-spacing: 1px;
  margin-top: 7px;
  color: #d1d8c5;
}
.timer {
  font-size: 28px;
  text-align: right;
}
.radar-panel {
  position: absolute;
  left: 32px;
  top: 100px;
  width: 135px;
}
.radar {
  border: 1px solid #c2d2ae88;
  opacity: 0.88;
}
.radar-panel small {
  font: 9px monospace;
  display: block;
  margin-top: 7px;
}
.kill-feed {
  position: absolute;
  right: 32px;
  top: 105px;
  font: 11px monospace;
  text-align: right;
}
.kill-feed p {
  background: #18241dc9;
  padding: 7px 12px;
  margin-bottom: 5px;
}
.crosshair {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font: 28px monospace;
  color: #f2ffdc;
  pointer-events: none;
  text-shadow: 0 1px 3px #000;
}
.crosshair.target {
  color: #ff5353;
}
.crosshair.hit {
  font-size: 38px;
  color: white;
}
.crosshair.kill {
  color: #ff914b;
}
.damage-flash {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 100px 35px #ac231c9c;
  pointer-events: none;
}
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: #101b1b66;
  backdrop-filter: blur(5px);
}
.menu-card {
  width: min(540px, 94vw);
  max-height: 95dvh;
  overflow: auto;
  background: #17231ff2;
  border: 1px solid #7b8c6266;
  padding: 30px 38px;
  box-shadow: 0 25px 80px #0006;
}
.eyebrow {
  font: 10px monospace;
  letter-spacing: 2px;
  color: #d9ff9c;
}
.menu-card h1 {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -1.5px;
  margin: 12px 0;
}
.menu-card p {
  font-size: 13px;
  line-height: 1.6;
  color: #bfccbb;
}
.menu-actions {
  display: grid;
  gap: 7px;
  margin: 22px 0;
}
.menu-actions button {
  display: flex;
  justify-content: space-between;
  text-align: left;
  border: 1px solid #5e6b58;
  padding: 13px 17px;
  font-size: 13px;
  cursor: pointer;
}
.menu-actions button.selected {
  background: #d9ff9c;
  color: #17231f;
  border-color: #d9ff9c;
  font-weight: bold;
}
.menu-actions button:disabled {
  opacity: 0.4;
  cursor: wait;
}
.menu-card p.controls {
  font-size: 10px;
  margin-top: 12px;
  line-height: 1.7;
}
.menu-card > small {
  display: block;
  font: 9px monospace;
  color: #9cab98;
  margin-top: 12px;
}
.audio-toggle,
.reconnect {
  font-size: 11px;
  text-decoration: underline;
  margin-top: 14px;
  cursor: pointer;
}
.results {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 25px 0;
  font: 9px monospace;
  color: #afc4a2;
}
.results strong {
  display: block;
  font-size: 25px;
  color: #eaffd6;
  margin-bottom: 8px;
}
.death {
  position: absolute;
  inset: 35% 0 auto;
  text-align: center;
  pointer-events: none;
  text-shadow: 0 2px 10px #000;
}
.death span {
  font: 12px monospace;
  letter-spacing: 4px;
  color: #ffab89;
}
.death h2 {
  font-size: 40px;
  font-weight: bold;
}
.death p {
  font-size: 13px;
}
footer {
  position: absolute;
  inset: auto 0 25px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 24px 32px 12px;
  pointer-events: none;
  background: linear-gradient(transparent, #101711a8);
}
footer small {
  display: block;
  font: 9px monospace;
  letter-spacing: 1px;
  color: #d0dcc3;
}
footer strong {
  font: 40px monospace;
  line-height: 1.25;
}
footer strong span {
  font-size: 19px;
  color: #c2ceba;
}
.health {
  width: 160px;
}
.health-bar {
  height: 4px;
  background: #6d776c;
  margin: 6px 0;
}
.health-bar i {
  display: block;
  height: 100%;
  background: #d9ff9c;
}
.ammo {
  text-align: right;
}
.score {
  text-align: center;
}
.score strong {
  font-size: 26px;
}
.telemetry {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 8px;
  font: 8px monospace;
  color: #adbaa3;
  background: #142018ba;
  pointer-events: none;
}
@media (max-width: 650px) {
  header {
    padding: 16px;
  }
  .location {
    display: none;
  }
  .radar-panel {
    left: 16px;
    top: 80px;
    width: 95px;
  }
  .kill-feed {
    right: 16px;
    top: 90px;
  }
  .menu-card {
    padding: 22px;
  }
  .menu-card h1 {
    font-size: 30px;
  }
  footer {
    padding: 15px;
  }
  .health {
    width: 110px;
  }
  .score small {
    max-width: 95px;
    line-height: 1.5;
  }
  .results strong {
    font-size: 20px;
  }
}
</style>

<style scoped>
.arena { font-family: 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif; }
.overlay { background: linear-gradient(90deg, rgba(7,13,17,.95), rgba(7,13,17,.66)); backdrop-filter: blur(4px); }
.menu-card { max-height: calc(100dvh - 100px); overflow-y: auto; border-top: 3px solid #ffb15c; background: rgba(15,23,28,.94); padding: 30px; box-shadow: 0 25px 100px #0007; }
.menu-card h1 { font-family: 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: -.035em; }
.menu-card .eyebrow { color: #ffb15c; letter-spacing: .22em; }
.menu-actions button { text-transform: uppercase; font-size: 13px; font-weight: 800; letter-spacing: .12em; }
.menu-actions button.selected { background: #ffb15c; color: #10171b; border-color: #ffb15c; }
.controls { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.65; }
.audio-toggle { text-transform: uppercase; font-size: 10px; letter-spacing: .1em; }
</style>

<style scoped>
.target-name { position:absolute; top:55%; left:50%; transform:translateX(-50%); color:#ffb15c; font:12px monospace; pointer-events:none; }
</style>
