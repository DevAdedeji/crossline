<script setup lang="ts">
import { readStick } from '@crossline/shared'

const modes = [
  {
    id: 'solo',
    number: '01',
    title: 'Solo vs Bots',
    subtitle: 'YOUR OWN BATTLEGROUND',
    description: 'A future full solo mode. For live bot practice, enter Training.',
    available: false,
    players: '1 PLAYER + BOTS',
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
    void navigateTo('/play')
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
  const pads = Array.from(navigator.getGamepads?.() ?? []).filter((pad): pad is Gamepad =>
    Boolean(pad?.connected),
  )
  const pad = pads.find((candidate) => candidate.mapping === 'standard')
  controller.value = pad
    ? 'GAMEPAD CONNECTED'
    : pads.length
      ? 'UNSUPPORTED PAD MAPPING'
      : 'MOUSE / KEYBOARD'
  if (pad && document.hasFocus() && !document.hidden) {
    const stick = readStick(pad.axes[0], pad.axes[1])
    const direction =
      pad.buttons[15]?.pressed || stick.x > 0.5
        ? 1
        : pad.buttons[14]?.pressed || stick.x < -0.5
          ? -1
          : pad.buttons[13]?.pressed || stick.y > 0.5
            ? 1
            : pad.buttons[12]?.pressed || stick.y < -0.5
              ? -1
              : 0
    if (direction && (direction !== previousDirection || time - lastStep > 250)) {
      focusMode(active.value + direction)
      lastStep = time
    }
    previousDirection = direction
    const confirm = Boolean(pad.buttons[0]?.pressed)
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
  <main
    class="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#101611] px-6 text-[#eef1e7] sm:px-12 lg:px-20"
  >
    <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div
        class="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_20%,#354638_0%,transparent_65%)]"
      />
      <svg
        class="absolute -right-[20%] -bottom-[35%] h-[135%] w-[110%] opacity-25 [transform:rotateX(45deg)_rotateZ(-25deg)]"
        viewBox="0 0 1000 1000"
        fill="none"
      >
        <defs>
          <pattern id="arena-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M80 0H0V80" stroke="#a8bd82" stroke-width="1" />
          </pattern>
        </defs>
        <rect
          x="40"
          y="40"
          width="920"
          height="920"
          fill="url(#arena-grid)"
          stroke="#d9f99b"
          stroke-width="4"
        />
        <g fill="#344b37" stroke="#b7cf8e" stroke-width="2">
          <rect x="160" y="160" width="230" height="100" />
          <rect x="650" y="180" width="170" height="250" />
          <rect x="160" y="580" width="160" height="240" />
          <rect x="580" y="700" width="230" height="110" />
        </g>
        <circle cx="500" cy="500" r="130" stroke="#d9f99b" stroke-width="3" />
        <path d="M460 500h80M500 460v80M40 500h320M640 500h320" stroke="#d9f99b" stroke-width="2" />
      </svg>
      <div class="absolute inset-0 bg-linear-to-r from-[#101611] via-[#101611bb] to-transparent" />
    </div>
    <header class="flex items-center justify-between border-b border-white/10 py-7">
      <span class="text-2xl font-black tracking-[-1.5px]"
        >CROSSLINE<span class="ml-1 text-lime-200">+</span></span
      >
      <span class="font-mono text-[10px] tracking-widest text-[#a4b397]">PROTOTYPE / 001</span>
    </header>
    <section class="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center py-8 lg:py-10">
      <div class="mb-6 flex items-end justify-between">
        <div>
          <p class="mb-3 font-mono text-[10px] tracking-[.3em] text-lime-200">CHOOSE YOUR MODE</p>
          <h1 class="text-6xl leading-none font-black tracking-[-4px] sm:text-8xl">
            PLAY<span class="text-lime-200">.</span>
          </h1>
        </div>
        <span class="hidden pb-2 font-mono text-[10px] tracking-widest text-[#98a98a] sm:block"
          >MERCER BLOCK / URBAN TRAINING</span
        >
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Game modes">
        <button
          v-for="(mode, index) in modes"
          :id="`mode-${mode.id}`"
          :key="mode.id"
          type="button"
          :tabindex="active === index ? 0 : -1"
          :aria-pressed="active === index"
          :aria-label="`${mode.title} — ${mode.available ? 'playable' : 'in development'}`"
          :class="[
            'group relative min-h-40 cursor-pointer border px-6 py-5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-lime-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101611]',
            active === index
              ? 'border-lime-200 bg-lime-200/10'
              : 'border-[#50604b] bg-[#162019bb] hover:border-[#a5bd86]',
          ]"
          @focus="setFocus(index)"
          @click="selectMode(index)"
        >
          <span
            class="absolute top-4 right-5 font-mono text-[10px] tracking-wide"
            :class="mode.available ? 'text-lime-200' : 'text-[#a4af9a]'"
            >{{ mode.available ? '● PLAYABLE' : 'IN DEVELOPMENT' }}</span
          >
          <span class="font-mono text-[10px] text-[#7d8e71]"
            >{{ mode.number }} / {{ mode.players }}</span
          >
          <h2
            class="mt-5 text-3xl font-bold tracking-tight"
            :class="active === index ? 'text-lime-200' : ''"
          >
            {{ mode.title
            }}<span v-if="active === index" class="ml-3 text-xl" aria-hidden="true">↗</span>
          </h2>
          <p class="mt-2 font-mono text-[9px] tracking-[.2em] text-[#a9b49c]">
            {{ mode.subtitle }}
          </p>
        </button>
      </div>
      <div
        class="mt-5 flex min-h-24 flex-col justify-between gap-5 border-t border-white/10 pt-5 sm:flex-row sm:items-center"
      >
        <div class="max-w-xl">
          <p class="text-sm leading-6 text-[#b9c3af]">{{ selected.description }}</p>
          <p class="mt-1 text-xs text-lime-200" role="status">{{ message }}</p>
        </div>
        <UButton
          to="/play"
          class="shrink-0 justify-center rounded-xs bg-lime-200 px-7 py-4 font-bold text-[#172011] hover:bg-lime-100"
          >Enter training ↗</UButton
        >
      </div>
    </section>
    <footer
      class="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-5 font-mono text-[9px] tracking-widest text-[#98a98a]"
    >
      <span>ARROWS / D-PAD / LEFT STICK: SELECT · ENTER / A / ×: CONFIRM</span
      ><span data-testid="menu-controller">{{ controller }}</span
      ><NuxtLink to="/credits" class="underline">ASSET CREDITS</NuxtLink>
    </footer>
  </main>
</template>
