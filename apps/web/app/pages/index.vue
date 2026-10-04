<script setup lang="ts">
import { currentAccount, authClient } from '~/game/account'
import type { Leaderboard } from '@crossline/shared'
import { prepareEntry } from '~/game/entry'
import { readStick, ONLINE_CAPACITY_TARGET } from '@crossline/shared'
import { selectController, controllerButtons } from '~/game/controller'

const controlsReady=ref(false)
const touchDevice=ref(false)
const arenaCapacity=ref(ONLINE_CAPACITY_TARGET)
const modes = reactive([
  {
    id: 'solo',
    number: '01',
    title: 'Solo vs Bots',
    subtitle: 'YOUR OWN BATTLEGROUND',
    description: 'Five minutes. Twelve bots. One rifle. Use cover, crouch and health packs to beat your best score.',
    available: true,
    players: '5 MIN · 1 PLAYER + 12 BOTS',
  },
  {
    id: 'online',
    number: '02',
    title: 'Online Free-for-All',
    subtitle: 'EVERY ANGLE IS YOURS',
    description: 'One shared human arena. Join anytime, collect health packs and climb the kill/death leaderboards.',
    available: true,
    get players(){return `SHARED ARENA · UP TO ${arenaCapacity.value} PLAYERS`},
  },
  {
    id: 'training',
    number: '03',
    title: 'Practice',
    subtitle: 'ENTER THE PROVING GROUND',
    description:
      'Three-minute practice with stationary targets and slow patrols. Master the carbine, streets, interiors and rooftops.',
    available: true,
    players: '1 PLAYER + 5 BOTS',
  },
])
onMounted(async()=>{if(!navigator.onLine)return;try{const arena=await $fetch<{capacity:number}>('/api/arena');arenaCapacity.value=arena.capacity}catch{/* Default capacity remains visible if the match server is unavailable. */}})
const showAccount=ref(false),account=ref<Awaited<ReturnType<typeof currentAccount>>>(null)
async function signedIn(){account.value=navigator.onLine?await currentAccount():null;showAccount.value=false;launching.value=true;await navigateTo('/play?mode=online')}
async function logout(){await authClient.signOut();account.value=null;sessionStorage.removeItem('crossline.ffa.reconnect')}
const active = ref(0)
const launching = ref(false)
const selected = computed(() => modes[active.value]!)
const message = ref('')
const controller = ref('MOUSE / KEYBOARD')
const showControls = ref(false),showLeaders=ref(false),leaders=ref<Leaderboard>(),leadersUnavailable=ref(false)
async function loadLeaders(){showLeaders.value=true;try{leaders.value=await $fetch<Leaderboard>('/api/leaderboard');leadersUnavailable.value=false}catch{leadersUnavailable.value=true}}
const callsign = ref('')
watch(callsign, value => { if(import.meta.client)try { localStorage.setItem('crossline.callsign',value) } catch {} })
let wasBackPressed = false, wasDetailsPressed = false
let frame = 0
let lastStep = 0
let wasConfirmPressed = false
let confirmArmed = false
let previousDirection = 0
function setFocus(index: number) {
  active.value = index
  message.value = ''
}
async function selectMode(index: number, usePad=false) {
  if(launching.value)return
  if(modes[index]?.id==='online'&&!navigator.onLine){message.value='Online needs internet. Practice and Solo run on this device.';return}
  if(modes[index]?.id==='online'&&!account.value){showAccount.value=true;return}
  launching.value=true;active.value=index
  const input=usePad?'pad':touchDevice.value?'touch':'mouse'
  await prepareEntry(input)
  await navigateTo(modes[index]?.id === 'training' ? '/play' : `/play?mode=${modes[index]?.id}`)
}

function focusMode(index: number) {
  active.value = (index + modes.length) % modes.length
  message.value = ''
  document.getElementById(`mode-${modes[active.value]!.id}`)?.focus()
}
function keydown(event: KeyboardEvent) {
  if(showAccount.value)return
  if (showLeaders.value) {if(event.key==='Escape')showLeaders.value=false;return}
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
  if(showAccount.value){frame=requestAnimationFrame(pollGamepad);return}
  const pad = selectController(Array.from(navigator.getGamepads?.() ?? []))
  controller.value = pad ? 'GAMEPAD CONNECTED' : 'MOUSE / KEYBOARD'
  if (pad && document.hasFocus() && !document.hidden) {
    const stick = readStick(pad.axes[0], pad.axes[1])
    const pressed = controllerButtons(pad)
    if (!pressed[0]) confirmArmed = true
    const back = Boolean(pressed[1]), details = Boolean(pressed[3])
    const controlsWereOpen = showControls.value || showLeaders.value
    if(showLeaders.value && ((back && !wasBackPressed) || (pressed[0] && !wasConfirmPressed)))showLeaders.value=false
    if ((back && !wasBackPressed) || (showControls.value && pressed[0] && !wasConfirmPressed)) showControls.value = false
    else if (details && !wasDetailsPressed) showControls.value = !showControls.value
    wasBackPressed = back; wasDetailsPressed = details
    if (showControls.value || showLeaders.value || controlsWereOpen) {
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
    if (confirmArmed && confirm && !wasConfirmPressed) void selectMode(active.value,true)
    wasConfirmPressed = confirm
  } else {
    wasConfirmPressed = false
    confirmArmed = false
    previousDirection = 0
  }
  frame = requestAnimationFrame(pollGamepad)
}
onMounted(() => {
  touchDevice.value=matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints>0
  controlsReady.value=true
  if(navigator.onLine)void currentAccount().then(value=>account.value=value).catch(()=>{})
  try { callsign.value=localStorage.getItem('crossline.callsign') ?? '' } catch {}
  window.addEventListener('keydown', keydown)
  frame = requestAnimationFrame(pollGamepad)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', keydown)
  cancelAnimationFrame(frame)
})
</script>

<template>
  <main :data-ready="controlsReady" class="lobby relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#101619] text-[#edf1ef]">
    <AccountGate v-if="showAccount" @signed-in="signedIn" @close="showAccount=false" />
    <div class="lobby-scene absolute inset-0 -z-20" aria-hidden="true" />
    <div class="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,13,16,.98)_0%,rgba(8,13,16,.86)_37%,rgba(8,13,16,.2)_75%),linear-gradient(0deg,rgba(8,13,16,.95),transparent_45%)]" aria-hidden="true" />
    <header class="flex items-center justify-between border-b border-white/10 px-6 py-5 sm:px-12">
      <a href="/" class="brand-word text-3xl font-black tracking-[-.06em]">CROSSLINE<span class="text-[#ffb15c]">+</span></a>
      <div class="flex items-center gap-5 text-[11px] font-bold tracking-[.2em] text-white/65">
        <button v-if="account" data-ui-action @click="logout">{{ account.username }} · LOG OUT</button>
        <span v-else class="hidden sm:block"><i class="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#bed496]" />LOCAL OPERATOR</span>
        <button data-ui-action class="border border-white/25 px-3 py-2 transition hover:border-[#ffb15c] focus-visible:outline-2 focus-visible:outline-[#ffb15c]" @click="showControls = true">CONTROLS</button>
      </div>
    </header>
    <section class="flex w-full flex-1 flex-col justify-center px-6 py-10 sm:px-12 lg:max-w-[720px] lg:px-16">
      <p class="mb-3 text-[11px] font-bold tracking-[.35em] text-[#ffb15c]">PLAY / MERCER BLOCK</p>
      <h1 class="display-type mb-8 text-5xl leading-none font-black uppercase tracking-[-.035em] sm:text-7xl">Choose your<br />battleground.</h1>
      <label class="callsign-field mb-5 flex flex-wrap items-center gap-3 text-xs tracking-widest text-white/65">GUEST NICKNAME
        <input v-model="callsign" data-ui-action maxlength="16" placeholder="OPERATOR" class="min-w-0 max-w-full border border-white/25 bg-black/40 px-3 py-2 text-white" aria-label="Nickname" />
      </label>
      <nav aria-label="Game modes" class="space-y-1">
        <button v-for="(mode, index) in modes" :id="`mode-${mode.id}`" :key="mode.id"
          class="group relative flex w-full items-center gap-5 border-l-4 px-5 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#ffb15c]"
          :class="[active === index ? 'border-[#ffb15c] bg-white/10' : 'border-transparent bg-black/10 hover:bg-white/5', mode.id === 'training' ? 'practice-option' : '']"
          :aria-label="mode.available ? mode.title : `${mode.title} — in development`"
          :aria-pressed="active === index" @mousemove="setFocus(index)" @focus="setFocus(index)" @click="selectMode(index)">
          <span class="text-xs tabular-nums text-white/35">{{ mode.number }}</span>
          <span class="flex-1"><strong class="display-type block text-2xl leading-none font-black uppercase tracking-wide sm:text-3xl">{{ mode.title }}</strong>
            <span class="mt-2 block text-[10px] tracking-[.2em] text-white/45">{{ mode.players }}</span></span>
          <span v-if="!mode.available" class="text-[9px] tracking-widest text-white/40">COMING LATER</span>
          <span v-else class="text-xl" :class="active === index ? 'text-[#ffb15c]' : 'text-white/25'">↗</span>
        </button>
      </nav>
      <div class="mt-6 min-h-[105px] border-t border-white/15 pt-5">
        <p class="mb-4 max-w-md text-sm leading-relaxed text-white/65">{{ selected.description }}</p>
        <p v-if="message" role="status" class="mt-3 text-xs text-[#ffb15c]">{{ message }}</p>
      </div>
    </section>
    <div class="pointer-events-none absolute right-12 bottom-28 hidden text-right lg:block">
      <p class="text-[10px] tracking-[.3em] text-white/50">URBAN COMBAT / LOCAL OPERATIONS</p>
      <p class="display-type mt-2 text-4xl font-black tracking-tight">MERCER BLOCK</p>
      <div class="mt-3 ml-auto h-px w-28 bg-[#ffb15c]" />
    </div>
    <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4 text-[10px] font-bold tracking-[.1em] text-white/50 sm:px-12">
      <span v-if="controlsReady && touchDevice">TAP A MODE TO PLAY</span>
      <span v-else-if="controlsReady">← → / D-PAD SELECT <span class="mx-3 text-white/20">|</span> ENTER / A / × PLAY</span>
      <div class="flex gap-6"><button data-ui-action @click="loadLeaders">LEADERBOARD</button><span v-if="controlsReady && !touchDevice" data-testid="menu-controller">{{ controller }}</span><NuxtLink to="/credits" class="hover:text-white">CREDITS</NuxtLink></div>
    </footer>
    <section v-if="showLeaders" role="dialog" aria-modal="true" aria-label="Arena leaders" class="absolute inset-0 z-20 grid place-items-center bg-black/85 p-6">
      <div class="w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-[#131d22] p-6"><LeaderboardPanel :board="leaders" :unavailable="leadersUnavailable" /><button data-ui-action class="mt-6 w-full bg-white/10 p-3" @click="showLeaders=false">CLOSE</button></div>
    </section>
    <section v-if="showControls" role="dialog" aria-modal="true" aria-label="Controls" class="absolute inset-0 z-20 grid place-items-center bg-black/80 p-6 backdrop-blur-sm">
      <div class="max-h-[90dvh] w-full max-w-lg overflow-y-auto border-t-2 border-[#ffb15c] bg-[#131d22] p-6 shadow-2xl sm:p-8">
        <p class="text-xs tracking-[.25em] text-[#ffb15c]">FIELD GUIDE</p><h2 class="display-type mt-2 mb-7 text-4xl font-black">STAY IN CONTROL.</h2>
        <dl v-if="touchDevice" class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm"><dt class="text-white/50">MOVE</dt><dd>Left movement stick</dd><dt class="text-white/50">LOOK</dt><dd>Swipe the right side</dd><dt class="text-white/50">FIRE</dt><dd>Hold FIRE</dd><dt class="text-white/50">AIM</dt><dd>Tap AIM to toggle sights</dd><dt class="text-white/50">CROUCH</dt><dd>Tap CROUCH</dd><dt class="text-white/50">RELOAD</dt><dd>Tap RELOAD</dd><dt class="text-white/50">PAUSE</dt><dd>Tap Ⅱ</dd></dl>
        <dl v-else class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm"><dt class="text-white/50">MOVE / LOOK</dt><dd>WASD + mouse / sticks</dd><dt class="text-white/50">FIRE</dt><dd>Left click / A / × / RT / R2</dd><dt class="text-white/50">AIM</dt><dd>Right click / LT / L2</dd><dt class="text-white/50">CROUCH</dt><dd>C toggle / Ctrl hold / R3 toggle</dd><dt class="text-white/50">RELOAD</dt><dd>R / Xbox X / PlayStation □</dd><dt class="text-white/50">SELECT / BACK</dt><dd>A / × · B / ○</dd><dt class="text-white/50">PAUSE</dt><dd>Esc / Start / B / ○</dd></dl>
        <TouchSettings v-if="touchDevice" />
        <p v-if="touchDevice" class="mt-6 text-xs leading-relaxed text-white/50">Turn your phone to landscape. Use the on-screen controls to play.</p>
        <p v-else class="mt-6 text-xs leading-relaxed text-white/50">Release A / × after selecting a mode, then press it to fire. For a generic controller, assign its trigger from the in-game Controls panel.</p>
        <button data-ui-action class="mt-7 w-full bg-white/10 py-3 text-xs font-bold tracking-widest hover:bg-white/20" @click="showControls = false">{{ touchDevice ? 'CLOSE' : 'CLOSE · ESC / B / ○' }}</button>
      </div>
    </section>
  </main>
</template>
<style scoped>
.display-type, .brand-word { font-family: 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif; font-stretch: condensed; }
.practice-option { margin-top: 1rem; padding-block: .8rem; opacity: .8; }
.practice-option strong { font-size: 1.15rem; }
@media(max-height:500px) and (orientation:landscape) { .lobby header,.lobby footer { padding-block:.55rem; } .lobby section { padding-block:1rem; } .lobby h1 { font-size:2rem; margin-bottom:.8rem; } .lobby nav button { padding-block:.65rem; } .lobby nav strong { font-size:1.2rem; } }
.lobby-scene { background: linear-gradient(130deg, #162026, #303c3e 55%, #171e21); background-image: url('/images/mercer-menu.jpg'); background-position: center; background-size: cover; }
</style>
