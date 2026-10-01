<script setup lang="ts">
import { readStick } from '@crossline/shared'
import { selectController, controllerButtons } from '~/game/controller'

const modes = [
  {
    id: 'solo',
    number: '01',
    title: 'Solo vs Bots',
    subtitle: 'YOUR OWN BATTLEGROUND',
    description: 'Twelve combat bots across nine districts. 156 × 156 metres. Fight for the top spot.',
    available: true,
    players: '1 PLAYER + 12 BOTS · LARGE MAP',
  },
  {
    id: 'online',
    number: '02',
    title: 'Online Free-for-All',
    subtitle: 'EVERY ANGLE IS YOURS',
    description: 'A shared arena with unlimited respawns. Online matchmaking is in development.',
    available: false,
    players: 'FREE-FOR-ALL',
  },
  {
    id: 'training',
    number: '03',
    title: 'Training',
    subtitle: 'ENTER THE PROVING GROUND',
    description:
      'Three-minute practice with stationary targets and slow patrols. Master the carbine, streets, interiors and rooftops.',
    available: true,
    players: '1 PLAYER + 5 BOTS',
  },
]
const active = ref(2)
const selected = computed(() => modes[active.value]!)
const message = ref('')
const controller = ref('MOUSE / KEYBOARD')
const showControls = ref(false)
let wasBackPressed = false, wasDetailsPressed = false
let frame = 0
let lastStep = 0
let wasConfirmPressed = false
let previousDirection = 0
function setFocus(index: number) {
  active.value = index
  message.value = ''
}
function selectMode(index: number) {
  active.value = index
  if (modes[index]?.available) {
    void navigateTo(modes[index]?.id === 'solo' ? '/play?mode=solo' : '/play')
    return
  }
  message.value = `${modes[index]!.title} is in development. Training is playable now.`
}
function focusMode(index: number) {
  active.value = (index + modes.length) % modes.length
  message.value = ''
  document.getElementById(`mode-${modes[active.value]!.id}`)?.focus()
}
function keydown(event: KeyboardEvent) {
  if (showControls.value) {
    if (event.key === 'Escape') showControls.value = false
    return
  }
  if ((event.target as HTMLElement)?.closest('[data-ui-action], a')) return
  const steps: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 }
  if (event.key in steps) {
    event.preventDefault()
    focusMode(active.value + steps[event.key]!)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    selectMode(active.value)
  }
}
function pollGamepad(time: number) {
  const pad = selectController(Array.from(navigator.getGamepads?.() ?? []))
  controller.value = pad ? 'GAMEPAD CONNECTED' : 'MOUSE / KEYBOARD'
  if (pad && document.hasFocus() && !document.hidden) {
    const stick = readStick(pad.axes[0], pad.axes[1])
    const pressed = controllerButtons(pad)
    const back = Boolean(pressed[1]), details = Boolean(pressed[3])
    const controlsWereOpen = showControls.value
    if ((back && !wasBackPressed) || (showControls.value && pressed[0] && !wasConfirmPressed)) showControls.value = false
    else if (details && !wasDetailsPressed) showControls.value = !showControls.value
    wasBackPressed = back; wasDetailsPressed = details
    if (showControls.value || controlsWereOpen) {
      wasConfirmPressed = Boolean(pressed[0])
      frame = requestAnimationFrame(pollGamepad)
      return
    }
    const direction =
      pressed[15] || stick.x > 0.5
        ? 1
        : pressed[14] || stick.x < -0.5
          ? -1
          : pressed[13] || stick.y > 0.5
            ? 1
            : pressed[12] || stick.y < -0.5
              ? -1
              : 0
    if (direction && (direction !== previousDirection || time - lastStep > 250)) {
      focusMode(active.value + direction)
      lastStep = time
    }
    previousDirection = direction
    const confirm = Boolean(pressed[0])
    if (confirm && !wasConfirmPressed) selectMode(active.value)
    wasConfirmPressed = confirm
  } else {
    wasConfirmPressed = false
    previousDirection = 0
  }
  frame = requestAnimationFrame(pollGamepad)
}
onMounted(() => {
  window.addEventListener('keydown', keydown)
  frame = requestAnimationFrame(pollGamepad)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', keydown)
  cancelAnimationFrame(frame)
})
</script>

<template>
  <main class="lobby relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#101619] text-[#edf1ef]">
    <div class="lobby-scene absolute inset-0 -z-20" aria-hidden="true" />
    <div class="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,13,16,.98)_0%,rgba(8,13,16,.86)_37%,rgba(8,13,16,.2)_75%),linear-gradient(0deg,rgba(8,13,16,.95),transparent_45%)]" aria-hidden="true" />
    <header class="flex items-center justify-between border-b border-white/10 px-6 py-5 sm:px-12">
      <a href="/" class="brand-word text-3xl font-black tracking-[-.06em]">CROSSLINE<span class="text-[#ffb15c]">+</span></a>
      <div class="flex items-center gap-5 text-[11px] font-bold tracking-[.2em] text-white/65">
        <span class="hidden sm:block"><i class="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#bed496]" />LOCAL OPERATOR</span>
        <button data-ui-action class="border border-white/25 px-3 py-2 transition hover:border-[#ffb15c] focus-visible:outline-2 focus-visible:outline-[#ffb15c]" @click="showControls = true">CONTROLS</button>
      </div>
    </header>
    <section class="flex w-full flex-1 flex-col justify-center px-6 py-10 sm:px-12 lg:max-w-[720px] lg:px-16">
      <p class="mb-3 text-[11px] font-bold tracking-[.35em] text-[#ffb15c]">PLAY / MERCER BLOCK</p>
      <h1 class="display-type mb-8 text-5xl leading-none font-black uppercase tracking-[-.035em] sm:text-7xl">Choose your<br />battleground.</h1>
      <nav aria-label="Game modes" class="space-y-1">
        <button v-for="(mode, index) in modes" :id="`mode-${mode.id}`" :key="mode.id"
          class="group relative flex w-full items-center gap-5 border-l-4 px-5 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#ffb15c]"
          :class="active === index ? 'border-[#ffb15c] bg-white/10' : 'border-transparent bg-black/10 hover:bg-white/5'"
          :aria-label="mode.available ? mode.title : `${mode.title} — in development`"
          :aria-pressed="active === index" @mousemove="setFocus(index)" @focus="setFocus(index)" @click="setFocus(index)">
          <span class="text-xs tabular-nums text-white/35">{{ mode.number }}</span>
          <span class="flex-1"><strong class="display-type block text-2xl leading-none font-black uppercase tracking-wide sm:text-3xl">{{ mode.title }}</strong>
            <span class="mt-2 block text-[10px] tracking-[.2em] text-white/45">{{ mode.players }}</span></span>
          <span v-if="!mode.available" class="text-[9px] tracking-widest text-white/40">COMING LATER</span>
          <span v-else class="text-xl" :class="active === index ? 'text-[#ffb15c]' : 'text-white/25'">↗</span>
        </button>
      </nav>
      <div class="mt-6 min-h-[105px] border-t border-white/15 pt-5">
        <p class="mb-4 max-w-md text-sm leading-relaxed text-white/65">{{ selected.description }}</p>
        <NuxtLink v-if="selected.available" :to="selected.id === 'solo' ? '/play?mode=solo' : '/play'"
          :aria-label="selected.id === 'solo' ? 'Enter solo vs bots' : 'Enter training'"
          class="inline-flex min-w-48 items-center justify-between gap-10 bg-[#ffb15c] px-6 py-3 text-sm font-black tracking-[.15em] text-[#161a1b] transition hover:bg-[#ffc98f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">DEPLOY <span>→</span></NuxtLink>
        <button v-else data-ui-action class="border border-white/20 px-6 py-3 text-xs font-bold tracking-widest text-white/40" @click="selectMode(active)">MATCHMAKING IN DEVELOPMENT</button>
        <p v-if="message" role="status" class="mt-3 text-xs text-[#ffb15c]">{{ message }}</p>
      </div>
    </section>
    <div class="pointer-events-none absolute right-12 bottom-28 hidden text-right lg:block">
      <p class="text-[10px] tracking-[.3em] text-white/50">URBAN COMBAT / LOCAL OPERATIONS</p>
      <p class="display-type mt-2 text-4xl font-black tracking-tight">MERCER BLOCK</p>
      <div class="mt-3 ml-auto h-px w-28 bg-[#ffb15c]" />
    </div>
    <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4 text-[10px] font-bold tracking-[.1em] text-white/50 sm:px-12">
      <span>← → / D-PAD SELECT <span class="mx-3 text-white/20">|</span> ENTER / A / × DEPLOY</span>
      <div class="flex gap-6"><span data-testid="menu-controller">{{ controller }}</span><NuxtLink to="/credits" class="hover:text-white">CREDITS</NuxtLink></div>
    </footer>
    <section v-if="showControls" role="dialog" aria-modal="true" aria-label="Controls" class="absolute inset-0 z-20 grid place-items-center bg-black/80 p-6 backdrop-blur-sm">
      <div class="w-full max-w-lg border-t-2 border-[#ffb15c] bg-[#131d22] p-8 shadow-2xl">
        <p class="text-xs tracking-[.25em] text-[#ffb15c]">FIELD GUIDE</p><h2 class="display-type mt-2 mb-7 text-4xl font-black">STAY IN CONTROL.</h2>
        <dl class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm"><dt class="text-white/50">MOVE / LOOK</dt><dd>WASD + mouse / sticks</dd><dt class="text-white/50">FIRE</dt><dd>Left click / A / × / RT / R2</dd><dt class="text-white/50">AIM</dt><dd>Right click / LT / L2</dd><dt class="text-white/50">RELOAD</dt><dd>R / Xbox X / PlayStation □</dd><dt class="text-white/50">SELECT / BACK</dt><dd>A / × · B / ○</dd><dt class="text-white/50">PAUSE</dt><dd>Esc / Start / B / ○</dd></dl>
        <p class="mt-6 text-xs leading-relaxed text-white/50">Release A / × after deploying, then press it to fire. For a generic controller, assign its trigger from the in-game Controls panel.</p>
        <button data-ui-action class="mt-7 w-full bg-white/10 py-3 text-xs font-bold tracking-widest hover:bg-white/20" @click="showControls = false">CLOSE · ESC / B / ○</button>
      </div>
    </section>
  </main>
</template>
<style scoped>
.display-type, .brand-word { font-family: 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif; font-stretch: condensed; }
.lobby-scene { background: linear-gradient(130deg, #162026, #303c3e 55%, #171e21); background-image: url('/images/mercer-menu.jpg'); background-position: center; background-size: cover; }
</style>
