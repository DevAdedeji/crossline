<script setup lang="ts">
import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { Client, type Room } from '@colyseus/sdk'
import { ROOM_NAME, TICK_MS, readStick } from '@crossline/shared'

interface PlayerState { x: number; z: number }
interface ArenaState { players: { forEach(callback: (player: PlayerState, id: string) => void): void; size: number } }
const canvas = ref<HTMLCanvasElement>()
const status = ref('Connecting')
const playerCount = ref(0)
const position = ref('0.0 / 0.0')
const captured = ref(false)
const padActive = ref(false)
const padStatus = ref('Connect a controller and press a button')
const padReady = ref(false)
let padMovement = { x: 0, y: 0 }
let previousStart = false
function pausePad() { padActive.value = false; padMovement = { x: 0, y: 0 }; clearInput() }
function activatePad() { if (padReady.value && status.value === 'Connected') { if (document.pointerLockElement) document.exitPointerLock(); padActive.value = true } }
function gamepadDisconnected() { pausePad(); padReady.value = false; padStatus.value = 'Controller disconnected — keyboard/mouse available' }
const loseFocus = () => { clearInput(); pausePad() }

const config = useRuntimeConfig()
let engine: Engine | undefined
let room: Room<ArenaState> | undefined
let timer: ReturnType<typeof setInterval> | undefined
let stopped = false
const keys = new Set<string>()
const keydown = (e: KeyboardEvent) => { if (e.code === 'Escape' && captured.value) document.exitPointerLock(); if (captured.value && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) { e.preventDefault(); keys.add(e.code) } }
const keyup = (e: KeyboardEvent) => keys.delete(e.code)
const clearInput = () => { keys.clear(); room?.send('input', { x: 0, z: 0 }) }
const pointerChange = () => { captured.value = document.pointerLockElement === canvas.value; if (!captured.value) clearInput() }
const resize = () => engine?.resize()
async function capture() {
  try { pausePad(); await canvas.value?.requestPointerLock() } catch { status.value = 'Mouse capture unavailable. Click the arena to try again.' }
}
onMounted(async () => {
  await nextTick()
  if (!canvas.value) { status.value = 'Canvas unavailable. Reload to retry.'; return }
  try {
    engine = new Engine(canvas.value, true)
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.065, 0.08, 0.075, 1)
    scene.fogMode = Scene.FOGMODE_EXP2
    scene.fogDensity = 0.014
    scene.fogColor = new Color3(0.065, 0.08, 0.075)
    const camera = new UniversalCamera('player-camera', new Vector3(0, 1.7, -5), scene)
    camera.minZ = 0.1
    camera.fov = 1.25
    camera.keysUp = []; camera.keysDown = []; camera.keysLeft = []; camera.keysRight = []
    camera.angularSensibility = 1800
    camera.inertia = 0
    camera.attachControl(canvas.value, true)
    new HemisphericLight('sky', new Vector3(0.4, 1, 0.2), scene)
    const material = (name: string, color: string) => { const m = new StandardMaterial(name, scene); m.diffuseColor = Color3.FromHexString(color); m.specularColor = Color3.Black(); return m }
    const floor = MeshBuilder.CreateGround('floor', { width: 40, height: 40 }, scene)
    floor.material = material('concrete', '#434c45')
    const wallMaterial = material('walls', '#68705e')
    for (const [x, z, width, depth] of [[0, 20, 40, 1], [0, -20, 40, 1], [20, 0, 1, 40], [-20, 0, 1, 40]]) {
      const wall = MeshBuilder.CreateBox('boundary', { width, depth, height: 3 }, scene)
      wall.position.set(x!, 1.5, z!); wall.material = wallMaterial
    }
    const lineMaterial = material('markings', '#d5e89b')
    for (let i = -16; i <= 16; i += 4) {
      for (const axis of ['x', 'z']) {
        const line = MeshBuilder.CreateBox('floor-line', { width: axis === 'x' ? 36 : 0.035, depth: axis === 'z' ? 36 : 0.035, height: 0.012 }, scene)
        line.position.set(axis === 'z' ? i : 0, 0.01, axis === 'x' ? i : 0); line.material = lineMaterial
      }
    }
    const avatarMaterial = material('players', '#e3f7a4')
    const avatars = new Map<string, Mesh>()
    engine.runRenderLoop(() => {
      const pads = Array.from(navigator.getGamepads?.() ?? []).filter((pad): pad is Gamepad => Boolean(pad?.connected))
      const pad = pads.find((candidate) => candidate.mapping === 'standard')
      padReady.value = Boolean(pad)
      if (pad) padStatus.value = `${pad.id} — standard mapping`
      else if (pads.length) padStatus.value = 'Unsupported controller mapping — use keyboard/mouse'
      else if (padActive.value) gamepadDisconnected()
      if (!pad && padActive.value) pausePad()
      if (pad && document.hasFocus() && !document.hidden) {
        const start = Boolean(pad.buttons[0]?.pressed)
        if (start && !previousStart) activatePad()
        if (pad.buttons[1]?.pressed) pausePad()
        previousStart = start
        if (padActive.value) {
          padMovement = readStick(pad.axes[0], pad.axes[1])
          const look = readStick(pad.axes[2], pad.axes[3])
          const dt = Math.min(engine!.getDeltaTime(), 50) / 1000
          camera.rotation.y += look.x * 2.4 * dt
          camera.rotation.x += look.y * 1.8 * dt
        }
      } else { previousStart = false; padMovement = { x: 0, y: 0 } }
      camera.rotation.x = Math.max(-1.45, Math.min(1.45, camera.rotation.x)); scene.render() })
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup)
    window.addEventListener('blur', loseFocus); window.addEventListener('gamepaddisconnected', gamepadDisconnected); window.addEventListener('resize', resize)
    document.addEventListener('pointerlockchange', pointerChange)
    const joined = await new Client(String(config.public.matchUrl)).joinOrCreate<ArenaState>(ROOM_NAME)
    if (stopped) { await joined.leave(); return }
    room = joined
    status.value = 'Connected'
    room.onStateChange((state) => {
      playerCount.value = state.players.size
      const active = new Set<string>()
      state.players.forEach((player, id) => {
        active.add(id)
        if (id === joined.sessionId) { camera.position.x = player.x; camera.position.z = player.z; position.value = `${player.x.toFixed(1)} / ${player.z.toFixed(1)}`; return }
        let mesh = avatars.get(id)
        if (!mesh) { mesh = MeshBuilder.CreateCapsule(id, { height: 1.8, radius: 0.35 }, scene); mesh.material = avatarMaterial; avatars.set(id, mesh) }
        mesh.position.set(player.x, 0.9, player.z)
      })
      for (const [id, mesh] of avatars) if (!active.has(id)) { mesh.dispose(); avatars.delete(id) }
    })
    room.onLeave(() => { status.value = 'Disconnected. Reload to reconnect.'; clearInterval(timer); keys.clear(); padActive.value = false; if (document.pointerLockElement === canvas.value) document.exitPointerLock() })
    room.onError(() => { status.value = 'Connection error. Reload to reconnect.' })
    timer = setInterval(() => {
      const forward = padActive.value ? -padMovement.y : Number(keys.has('KeyW')) - Number(keys.has('KeyS'))
      const right = padActive.value ? padMovement.x : Number(keys.has('KeyD')) - Number(keys.has('KeyA'))
      const yaw = camera.rotation.y
      const length = Math.max(1, Math.hypot(forward, right))
      joined.send('input', { x: (Math.sin(yaw) * forward + Math.cos(yaw) * right) / length, z: (Math.cos(yaw) * forward - Math.sin(yaw) * right) / length })
    }, TICK_MS)
  } catch {
    if (!stopped) status.value = 'Arena unavailable. Start the match server and reload; WebGL is required.'
  }
})
onBeforeUnmount(() => {
  stopped = true; clearInterval(timer)
  if (document.pointerLockElement === canvas.value) document.exitPointerLock()
  void room?.leave(); engine?.dispose()
  window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup)
  window.removeEventListener('blur', loseFocus); window.removeEventListener('gamepaddisconnected', gamepadDisconnected); window.removeEventListener('resize', resize)
  document.removeEventListener('pointerlockchange', pointerChange)
})
</script>

<template>
  <div class="relative h-dvh min-h-[500px] overflow-hidden">
    <canvas ref="canvas" class="block size-full outline-none" aria-label="Crossline 3D training arena" @click="capture" />
    <header class="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-linear-to-b from-[#101711e6] to-transparent p-6 md:px-8 [&_a]:pointer-events-auto"><NuxtLink to="/" class="text-[26px] font-black tracking-[-1.5px] [&>span]:pl-1 [&>span]:text-lime-200">CROSSLINE<span>+</span></NuxtLink><div class="hidden text-center font-mono text-[11px] tracking-widest text-lime-200 md:block [&>span]:mt-1 [&>span]:block [&>span]:text-[9px] [&>span]:text-[#b6c0ac]">SECTOR 01 <span>TRAINING LAB</span></div><NuxtLink to="/" class="text-xs">Leave arena ↗</NuxtLink></header>
    <div class="absolute top-24 left-5 flex items-center gap-2 bg-[#172019ce] px-3 py-2.5 font-mono text-[10px] tracking-wider md:left-8 [&>span:last-child]:ml-4 [&>span:last-child]:text-[#afbaa2]" role="status"><span class="inline-block size-1.5 rounded-full bg-lime-200" />{{ status }}<span>{{ playerCount }} / 8 PLAYERS</span></div>
    <div v-if="!captured && !padActive" class="absolute top-1/2 left-1/2 w-[min(530px,90vw)] -translate-1/2 border border-[#687759] bg-[#141c16ed] p-7 text-center shadow-2xl md:p-10 [&_.eyebrow]:justify-center"><span class="eyebrow justify-center flex items-center gap-2.5 font-mono text-[11px] tracking-widest text-lime-200">MOVEMENT PROTOTYPE</span><h1 class="my-5 text-4xl font-bold tracking-tight">Step across the line.</h1><p class="text-sm text-[#b5bfaa]">W A S D to move. Mouse to look. Esc to release.</p><UButton :disabled="status !== 'Connected'" size="xl" class="my-6 inline-flex cursor-pointer gap-10 rounded-xs bg-lime-200 px-6 py-4 font-bold text-[#172011] hover:bg-lime-100 disabled:opacity-40" @click="capture">Take control ↗</UButton><UButton v-if="padReady" :disabled="status !== 'Connected'" class="ml-3 rounded-xs bg-lime-200 px-5 py-4 font-bold text-[#172011]" @click="activatePad">Use gamepad</UButton><p class="text-xs text-lime-200">Left stick: move · Right stick: look · A / ×: play · B / ○: pause</p><p data-testid="gamepad-status" class="mt-2 max-w-full truncate text-[10px] text-[#b5bfaa]">{{ padStatus }}</p><p class="mt-2.5 text-[10px] text-[#b5bfaa]">Movement only. Weapons and game modes are coming later.</p></div>
    <div v-if="captured || padActive" class="crosshair pointer-events-none absolute top-1/2 left-1/2 -translate-1/2 font-mono text-[26px] text-[#e3f7bd]" aria-hidden="true">+</div>
    <footer class="absolute inset-x-0 bottom-0 flex flex-wrap justify-between gap-5 bg-[#121a13e8] px-5 py-5 font-mono text-[9px] tracking-wider text-[#83907d] md:px-8 [&_b]:font-normal [&_b]:text-[#c8d5b7]"><span>WASD <b>MOVE</b> / MOUSE <b>LOOK</b> / ESC <b>RELEASE</b></span><span data-testid="position">{{ position }}</span><span v-if="padActive">GAMEPAD / B or ○ TO PAUSE</span><span v-else>30 HZ / SERVER SIMULATION</span></footer>
  </div>
</template>
