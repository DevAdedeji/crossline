<script setup lang="ts">
import type { Engine } from '@babylonjs/core/Engines/engine'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { createUrbanScene } from '~/game/createUrbanScene'
import { rotateLook, MOUSE_SENSITIVITY } from '~/game/look'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { Client, type Room } from '@colyseus/sdk'
import { ROOM_NAME, TICK_MS, readStick, BLOCK_NAME, BUILDINGS } from '@crossline/shared'

interface PlayerState { x: number; y: number; z: number }
interface ArenaState { players: { forEach(callback: (player: PlayerState, id: string) => void): void; size: number } }
const canvas = ref<HTMLCanvasElement>()
const status = ref('Connecting')
const playerCount = ref(0)
const position = ref('0.0 / 0.0')
const altitude = ref('0.0')
const area = ref('SOUTH APPROACH')
const captured = ref(false)
const look = { yaw: 0, pitch: 0 }
const heading = ref(0)
const pitch = ref(0)
const captureError = ref('')
const mouseLook = (event: MouseEvent) => {
  if (document.pointerLockElement !== canvas.value || status.value !== 'Connected') return
  Object.assign(look, rotateLook(look, event.movementX * MOUSE_SENSITIVITY, event.movementY * MOUSE_SENSITIVITY))
}

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
const pointerChange = () => { captured.value = document.pointerLockElement === canvas.value; if (captured.value) captureError.value = ''; else clearInput() }
const resize = () => engine?.resize()
async function capture() {
  if (status.value !== 'Connected') return
  try { pausePad(); captureError.value = ''; await canvas.value?.requestPointerLock() } catch { captureError.value = 'Mouse capture was declined. Click Take control again, or use a connected gamepad.' }
}
onMounted(async () => {
  await nextTick()
  if (!canvas.value) { status.value = 'Canvas unavailable. Reload to retry.'; return }
  try {
    const arena = createUrbanScene(canvas.value)
    engine = arena.engine
    const { scene, camera, avatarMaterial } = arena
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
          const stickLook = readStick(pad.axes[2], pad.axes[3])
          const view = look
          const dt = Math.min(engine!.getDeltaTime(), 50) / 1000
          Object.assign(view, rotateLook(view, stickLook.x * 2.4 * dt, stickLook.y * 1.8 * dt))
        }
      } else { previousStart = false; padMovement = { x: 0, y: 0 } }
      camera.rotation.set(look.pitch, look.yaw, 0)
      heading.value = ((look.yaw * 180 / Math.PI) % 360 + 360) % 360
      pitch.value = look.pitch
      scene.render() })
    document.addEventListener('mousemove', mouseLook); window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup)
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
        if (id === joined.sessionId) { camera.position.x = player.x; camera.position.y = player.y + 1.7; camera.position.z = player.z; altitude.value = player.y.toFixed(1); const building = BUILDINGS.find((value) => Math.abs(player.x - value.x) < value.width / 2 && Math.abs(player.z - value.z) < value.depth / 2); area.value = player.y > 3.8 ? 'ROOFTOPS' : building ? building.name : 'MERCER STREET'; position.value = `${player.x.toFixed(1)} / ${player.z.toFixed(1)}`; return }
        let mesh = avatars.get(id)
        if (!mesh) { mesh = MeshBuilder.CreateCapsule(id, { height: 1.8, radius: 0.35 }, scene); mesh.material = avatarMaterial; avatars.set(id, mesh) }
        mesh.position.set(player.x, player.y + 0.9, player.z)
      })
      for (const [id, mesh] of avatars) if (!active.has(id)) { mesh.dispose(); avatars.delete(id) }
    })
    room.onLeave(() => { status.value = 'Disconnected. Reload to reconnect.'; clearInterval(timer); keys.clear(); padActive.value = false; if (document.pointerLockElement === canvas.value) document.exitPointerLock() })
    room.onError(() => { status.value = 'Connection error. Reload to reconnect.' })
    timer = setInterval(() => {
      const forward = padActive.value ? -padMovement.y : Number(keys.has('KeyW')) - Number(keys.has('KeyS'))
      const right = padActive.value ? padMovement.x : Number(keys.has('KeyD')) - Number(keys.has('KeyA'))
      const yaw = look.yaw
      const length = Math.max(1, Math.hypot(forward, right))
      joined.send('input', { x: (Math.sin(yaw) * forward + Math.cos(yaw) * right) / length, z: (Math.cos(yaw) * forward - Math.sin(yaw) * right) / length })
    }, TICK_MS)
  } catch (error) {
    console.error('Urban arena initialization failed', error)
    if (!stopped) status.value = 'Arena unavailable. Start the match server and reload; WebGL is required.'
  }
})
onBeforeUnmount(() => {
  stopped = true; clearInterval(timer)
  if (document.pointerLockElement === canvas.value) document.exitPointerLock()
  void room?.leave(); engine?.dispose()
  document.removeEventListener('mousemove', mouseLook); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup)
  window.removeEventListener('blur', loseFocus); window.removeEventListener('gamepaddisconnected', gamepadDisconnected); window.removeEventListener('resize', resize)
  document.removeEventListener('pointerlockchange', pointerChange)
})
</script>

<template>
  <div class="relative h-dvh min-h-[500px] overflow-hidden">
    <canvas ref="canvas" class="block size-full outline-none" aria-label="Crossline 3D training arena" @click="capture" />
    <header class="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-linear-to-b from-[#101711e6] to-transparent p-6 md:px-8 [&_a]:pointer-events-auto"><NuxtLink to="/" class="text-[26px] font-black tracking-[-1.5px] [&>span]:pl-1 [&>span]:text-lime-200">CROSSLINE<span>+</span></NuxtLink><div class="hidden text-center font-mono text-[11px] tracking-widest text-lime-200 md:block [&>span]:mt-1 [&>span]:block [&>span]:text-[9px] [&>span]:text-[#b6c0ac]">{{ BLOCK_NAME }} <span>{{ area }}</span></div><NuxtLink to="/" class="text-xs">Leave arena ↗</NuxtLink></header>
    <div class="absolute top-24 left-5 flex items-center gap-2 bg-[#172019ce] px-3 py-2.5 font-mono text-[10px] tracking-wider md:left-8 [&>span:last-child]:ml-4 [&>span:last-child]:text-[#afbaa2]" role="status"><span class="inline-block size-1.5 rounded-full bg-lime-200" />{{ status }}<span>{{ playerCount }} / 8 PLAYERS</span></div>
    <div v-if="!captured && !padActive" class="absolute top-1/2 left-1/2 w-[min(530px,90vw)] -translate-1/2 border border-[#687759] bg-[#141c16ed] p-7 text-center shadow-2xl md:p-10 [&_.eyebrow]:justify-center"><span class="eyebrow justify-center flex items-center gap-2.5 font-mono text-[11px] tracking-widest text-lime-200">URBAN TRAINING</span><h1 class="my-5 text-4xl font-bold tracking-tight">Explore Mercer Block.</h1><p class="text-sm text-[#b5bfaa]">W A S D to move. Click Take control, then move your mouse to look freely in any direction. Esc pauses mouse control.</p><UButton :disabled="status !== 'Connected'" size="xl" class="my-6 inline-flex cursor-pointer gap-10 rounded-xs bg-lime-200 px-6 py-4 font-bold text-[#172011] hover:bg-lime-100 disabled:opacity-40" @click="capture">Take control ↗</UButton><UButton v-if="padReady" :disabled="status !== 'Connected'" class="ml-3 rounded-xs bg-lime-200 px-5 py-4 font-bold text-[#172011]" @click="activatePad">Use gamepad</UButton><UButton v-if="status.startsWith('Disconnected') || status.startsWith('Connection error') || status.startsWith('Arena unavailable')" class="my-3 rounded-xs bg-lime-200 px-5 py-3 text-[#172011]" @click="reloadNuxtApp()">Reload and reconnect</UButton><p v-if="captureError" class="mb-3 text-sm text-amber-200" role="alert">{{ captureError }}</p><p class="text-xs text-lime-200">Left stick: move · Right stick: look · A / ×: play · B / ○: pause</p><p data-testid="gamepad-status" class="mt-2 max-w-full truncate text-[10px] text-[#b5bfaa]">{{ padStatus }}</p><p class="mt-2.5 text-[10px] text-[#b5bfaa]">Three interiors · Parked-car cover · West ramp to the cafe rooftop. Movement only; no weapons yet.</p></div>
    <div v-if="captured || padActive" class="crosshair pointer-events-none absolute top-1/2 left-1/2 -translate-1/2 font-mono text-[26px] text-[#e3f7bd]" aria-hidden="true">+</div>
    <footer class="absolute inset-x-0 bottom-0 flex flex-wrap justify-between gap-5 bg-[#121a13e8] px-5 py-5 font-mono text-[9px] tracking-wider text-[#83907d] md:px-8 [&_b]:font-normal [&_b]:text-[#c8d5b7]"><span>WASD <b>MOVE</b> / MOUSE <b>LOOK</b> / ESC <b>RELEASE</b></span><span data-testid="heading" :data-pitch="pitch.toFixed(4)">LOOK {{ (Math.round(heading) % 360).toString().padStart(3, '0') }}°</span><span data-testid="position">{{ position }}</span><span>HEIGHT <span data-testid="altitude">{{ altitude }}</span> M</span><span v-if="padActive">RIGHT STICK: LOOK 360° / B or ○: PAUSE</span><span v-else>{{ captured ? 'MOUSE CAPTURED / LOOK 360°' : 'CLICK TAKE CONTROL TO RESUME' }}</span></footer>
  </div>
</template>
