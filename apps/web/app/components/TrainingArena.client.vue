<script setup lang="ts">
import type { Engine } from '@babylonjs/core/Engines/engine'
import { Client, type Room } from '@colyseus/sdk'
import { ROOM_NAME, TICK_MS, readStick, BLOCK_NAME, BUILDINGS } from '@crossline/shared'
import {
  RIFLE,
  EYE_HEIGHT,
  aimedTarget,
  direction,
  type Combatant,
  type GameEvent,
  type Phase,
} from '@crossline/shared/combat'
import { createUrbanScene } from '~/game/createUrbanScene'
import { loadTrainingAssets } from '~/game/trainingAssets'
import { combatPresentation, trainingAudio } from '~/game/combatPresentation'
import { rotateLook, MOUSE_SENSITIVITY } from '~/game/look'
interface ArenaState {
  actors: { forEach(callback: (actor: Combatant, id: string) => void): void }
  phase: Phase
  elapsed: number
  duration: number
  round: number
}
const canvas = ref<HTMLCanvasElement>(),
  status = ref('Connecting'),
  phase = ref<Phase>('ready'),
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
  menuAxis = false
const active = computed(
  () =>
    status.value === 'Connected' &&
    phase.value === 'playing' &&
    (captured.value || padActive.value),
)
const seconds = computed(() => Math.ceil(Math.max(0, duration.value - elapsed.value) / 1000))
const time = computed(
  () => `${Math.floor(seconds.value / 60)}:${String(seconds.value % 60).padStart(2, '0')}`,
)
const accuracy = computed(() =>
  self.value?.shots ? Math.round((self.value.hits / self.value.shots) * 100) : 0,
)
const reloadLeft = computed(() => Math.max(0, (self.value?.reloadUntil ?? 0) - elapsed.value))
const menuItems = computed(() =>
  phase.value === 'finished'
    ? ['Run it again', 'Return to menu']
    : phase.value === 'paused'
      ? ['Resume training', 'Restart training', 'Finish session', 'Return to menu']
      : ['Start training', 'Return to menu'],
)
function action(value: string) {
  room?.send('action', value)
}
function clearInput() {
  keys.clear()
  mouseFire = false
  mouseAim = false
  padMovement = { x: 0, y: 0 }
  padFire = false
  padAim = false
  room?.send('input', { x: 0, z: 0, ...look, fire: false, aim: false })
}
function release() {
  clearInput()
  padActive.value = false
  if (document.pointerLockElement === canvas.value) document.exitPointerLock()
}
function pause() {
  audio.stop()
  if (phase.value === 'playing') {
    action('pause')
    phase.value = 'paused'
    menuIndex.value = 0
  }
  release()
}
function gamepadDisconnected() {
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
    padActive.value = true
    action('start')
    return
  }
  try {
    await canvas.value?.requestPointerLock()
    if (document.pointerLockElement === canvas.value) {
      padActive.value = false
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
  if (label === 'Restart training' || label === 'Run it again') {
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
  if (captured.value && active.value)
    Object.assign(
      look,
      rotateLook(look, event.movementX * MOUSE_SENSITIVITY, event.movementY * MOUSE_SENSITIVITY),
    )
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
  const pads = Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad =>
      Boolean(p?.connected),
    ),
    pad = pads.find((p) => p.mapping === 'standard')
  if (!pad) {
    if (padActive.value) gamepadDisconnected()
    padReady.value = false
    if (pads.length) padStatus.value = 'Unsupported mapping — use keyboard/mouse'
    previousButtons = []
    return
  }
  padReady.value = true
  padStatus.value = `${pad.id} — standard mapping`
  const pressed = pad.buttons.map((b) => b.pressed),
    edge = (i: number) => pressed[i] && !previousButtons[i]
  if (document.hasFocus() && !document.hidden) {
    if (phase.value === 'playing') {
      if (edge(9) || edge(1)) pause()
      if (padActive.value) {
        padMovement = readStick(pad.axes[0], pad.axes[1])
        const right = readStick(pad.axes[2], pad.axes[3])
        Object.assign(look, rotateLook(look, right.x * 2.4 * dt, right.y * 1.8 * dt))
        padFire = Boolean(pressed[7])
        padAim = Boolean(pressed[6])
        if (edge(2)) reload()
      }
    } else {
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
    const arena = createUrbanScene(canvas.value)
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
    const visuals = combatPresentation(scene, camera, assets, arena.shadows)
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
    const joined = await new Client(String(config.public.matchUrl)).create<ArenaState>(ROOM_NAME)
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
      if (phase.value !== state.phase) menuIndex.value = 0
      phase.value = state.phase
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
        const building = BUILDINGS.find(
          (b) => Math.abs(player.x - b.x) < b.width / 2 && Math.abs(player.z - b.z) < b.depth / 2,
        )
        area.value = player.y > 3.8 ? 'ROOFTOPS' : building ? building.name : 'MERCER STREET'
      }
      visuals.sync(values)
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
    room.onLeave(() => {
      if (stopped) return
      status.value = 'Disconnected'
      clearInterval(timer)
      release()
    })
    room.onError(() => {
      status.value = 'Connection error'
      release()
    })
    timer = setInterval(() => {
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
  <main class="arena" :data-phase="phase">
    <canvas ref="canvas" aria-label="Crossline 3D training arena" @contextmenu.prevent />
    <header>
      <NuxtLink to="/" class="brand">CROSSLINE<span>+</span></NuxtLink>
      <div class="location">
        {{ BLOCK_NAME }}<small>{{ area }}</small>
      </div>
      <div class="timer" data-testid="timer">
        {{ time }}<small>TRAINING / ROUND {{ round }}</small>
      </div>
    </header>
    <aside class="radar-panel">
      <svg viewBox="-28 -28 56 56" aria-label="Training radar" class="radar">
        <rect x="-27" y="-27" width="54" height="54" fill="#1d2929" />
        <path d="M-27 0H27M0-27V27" stroke="#58615b" stroke-width="6" />
        <rect
          v-for="b in BUILDINGS"
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
          :r="a.bot ? 0.9 : 1.3"
          :fill="a.bot ? '#ff9460' : '#d9ff9c'"
          :opacity="a.health > 0 ? 1 : 0.2"
          :data-actor="a.id"
          :data-x="a.x"
          :data-y="a.y"
          :data-z="a.z"
          :data-health="a.health"
        >
          <title>{{ a.name }}</title>
        </circle></svg
      ><small>{{ status }} · 3 TARGETS · 2 PATROLS</small>
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
              : 'MERCER BLOCK / LIVE PRACTICE'
        }}</span>
        <h1>
          {{
            phase === 'finished'
              ? 'Training complete.'
              : phase === 'paused'
                ? 'Training paused.'
                : 'Learn the block.'
          }}
        </h1>
        <p v-if="phase === 'ready'">
          Three minutes. Three stationary targets and two slow patrols. Practice aim, reloads and
          cover across streets, interiors and rooftops.
        </p>
        <p v-if="phase === 'paused'">
          The whole session is paused. Your timer and opponents will wait.
        </p>
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
        <div class="menu-actions">
          <button
            v-for="(label, i) in menuItems"
            :key="label"
            :class="{ selected: menuIndex === i }"
            :disabled="status !== 'Connected' && label !== 'Return to menu'"
            @mouseenter="menuIndex = i"
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
        <p class="controls">
          WASD move · Mouse look · Left click fire · Right click aim<br />R reload · Esc pause ·
          Health regenerates after cover
        </p>
        <p class="controls">
          Controller: sticks move/look · RT fire · LT aim · X / □ reload<br />A / × select · Start
          or B / ○ pause · D-pad navigate
        </p>
        <small data-testid="gamepad-status">{{ padStatus }}</small>
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
        ><small v-else>R / X RELOAD</small>
      </div>
    </footer>
    <div class="telemetry">
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
