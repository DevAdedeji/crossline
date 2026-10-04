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
    <section class="lobby-content">
      <div class="lobby-heading">
        <p class="lobby-eyebrow"><span /> MERCER DISTRICTS · URBAN COMBAT</p>
        <h1>Every angle.<br /><em>Your arena.</em></h1>
        <p class="lobby-intro">Take the rooftops. Hold your ground. Make your next move count.</p>
      </div>
      <div class="mode-picker">
        <div class="section-caption"><span>CHOOSE YOUR MODE</span><span>01 — 03</span></div>
        <nav aria-label="Game modes" class="mode-grid">
          <button v-for="(mode, index) in modes" :id="`mode-${mode.id}`" :key="mode.id"
            class="mode-card" :class="{ 'is-selected': active === index }"
            :aria-label="mode.title" :aria-pressed="active === index" @focus="setFocus(index)" @click="setFocus(index)">
            <span class="mode-top"><span>{{ mode.number }}</span><span class="mode-check" aria-hidden="true">{{ active === index ? '●' : '○' }}</span></span>
            <strong>{{ mode.title }}</strong>
            <span class="mode-players">{{ mode.players }}</span>
            <span class="mode-description">{{ mode.description }}</span>
          </button>
        </nav>
        <div class="launch-row">
          <label class="callsign-field">{{ account ? 'GUEST CALLSIGN' : 'YOUR CALLSIGN' }}<input v-model="callsign" data-ui-action maxlength="16" placeholder="OPERATOR" aria-label="Nickname" /></label>
          <p class="launch-note">{{ selected.id === 'online' ? 'A shared arena. Every player for themselves.' : selected.id === 'solo' ? 'Your next personal best starts here.' : 'Find your aim. Learn the streets.' }}</p>
          <button data-ui-action class="play-button" :disabled="launching" @click="selectMode(active)">Play {{ selected.title }} <span aria-hidden="true">↗</span></button>
        </div>
        <p v-if="message" role="status" class="launch-message">{{ message }}</p>
      </div>
    </section>
    <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4 text-[10px] font-bold tracking-[.1em] text-white/50 sm:px-12">
      <span v-if="controlsReady && touchDevice">CHOOSE A MODE · TAP PLAY</span>
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
.display-type,.brand-word{font-family:'Arial Narrow','Helvetica Neue',Arial,sans-serif;font-stretch:condensed}
.lobby{color:var(--cl-text);background:var(--cl-bg)}
.lobby-content{width:100%;max-width:1440px;margin:auto;flex:1;display:flex;flex-direction:column;justify-content:center;gap:42px;padding:48px 64px}
.lobby-heading{max-width:680px}.lobby-eyebrow{display:flex;align-items:center;gap:9px;color:var(--cl-accent);font-size:11px;letter-spacing:.12em;font-weight:700}.lobby-eyebrow span{width:6px;height:6px;background:var(--cl-accent);border-radius:50%}
h1{font-size:clamp(44px,6.5vw,88px);font-weight:850;letter-spacing:-.055em;line-height:.98;margin:22px 0}h1 em{font-style:normal;color:var(--cl-accent)}.lobby-intro{color:#d4d8d8;font-size:15px;line-height:1.6;max-width:390px}
.mode-picker{width:100%}.section-caption{display:flex;justify-content:space-between;font-size:10px;font-weight:700;letter-spacing:.12em;color:var(--cl-muted);margin-bottom:12px}.section-caption span:last-child{opacity:.55}
.mode-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.mode-card{position:relative;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:14px;padding:22px;border:1px solid var(--cl-line);border-radius:8px;background:#111519d9;backdrop-filter:blur(12px);transition:border-color .15s,background .15s;min-width:0}.mode-card:hover{background:#242a2fe8;border-color:#ffffff66}.mode-card.is-selected{border-color:var(--cl-accent);background:linear-gradient(140deg,#443529e8,#1c2024f5);box-shadow:inset 0 3px var(--cl-accent)}.mode-top{display:flex;justify-content:space-between;width:100%;color:var(--cl-muted);font-size:11px}.mode-check{color:var(--cl-accent)}.mode-card strong{font-size:clamp(18px,2.2vw,28px);font-weight:750;letter-spacing:-.035em}.mode-players{font-size:10px;font-weight:650;color:var(--cl-accent);letter-spacing:.025em}.mode-description{font-size:12px;line-height:1.6;color:var(--cl-muted);max-width:330px}
.launch-row{display:flex;align-items:center;gap:24px;margin-top:22px}.callsign-field{font-size:9px;letter-spacing:.09em;color:var(--cl-muted);width:180px;flex-shrink:0}.callsign-field input{display:block;width:100%;border-bottom:1px solid #ffffff50;margin-top:5px;padding:8px 0;font-size:14px;font-weight:600;letter-spacing:.04em;color:var(--cl-text);background:transparent}.launch-note{font-size:12px;color:var(--cl-muted);flex:1}.play-button{display:flex;justify-content:space-between;align-items:center;gap:32px;min-width:245px;padding:18px 22px;border-radius:6px;background:var(--cl-accent);color:#17191c;font-size:15px;font-weight:750;box-shadow:0 5px 28px #0003}.play-button:hover{background:#ffd19d}.play-button:disabled{opacity:.6}.play-button span{font-size:23px;line-height:1}.launch-message{color:var(--cl-accent);margin-top:12px;font-size:13px}
.lobby-scene{background:#162026 url('/images/mercer-menu.jpg') center/cover}
@media(min-width:761px) and (max-height:850px) and (min-height:551px){.lobby-content{padding:24px 48px;gap:24px}h1{font-size:clamp(48px,5vw,68px);margin:14px 0}.lobby-intro{max-width:none;font-size:13px}.mode-card{padding:18px;gap:10px}.launch-row{margin-top:16px}.play-button{padding:14px 20px}}
@media(max-width:760px){.lobby-content{padding:30px 24px;gap:30px}.mode-card{padding:16px;gap:12px}.mode-description{display:none}.mode-card strong{font-size:19px}.mode-players{font-size:9px;line-height:1.5}.launch-row{flex-wrap:wrap;gap:20px}.launch-note{display:none}.play-button{flex:1;min-width:200px}.callsign-field{width:130px}.lobby-intro{font-size:13px}.lobby-eyebrow{font-size:9px}}
@media(max-width:480px){.mode-grid{grid-template-columns:1fr}.mode-card{display:grid;grid-template-columns:22px 1fr;gap:7px 12px;padding:16px}.mode-top{grid-row:1/3;display:block}.mode-check{display:none}.mode-card strong{font-size:22px}.mode-players{grid-column:2}.launch-row{gap:14px}.play-button{width:100%;flex-basis:100%}.callsign-field{width:100%}}
@media(max-height:550px) and (orientation:landscape){.lobby>header,.lobby>footer{padding:10px 24px}.lobby-content{padding:18px 24px;gap:18px}.lobby-heading{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;max-width:none;align-items:center}.lobby-eyebrow{grid-column:1/-1;font-size:9px}h1{font-size:34px;margin:4px 0}h1 br{display:none}h1 em{margin-left:8px}.lobby-intro{font-size:12px}.mode-card{padding:12px 16px;gap:8px}.mode-description{display:none}.mode-card strong{font-size:20px}.mode-top{display:none}.mode-players{font-size:9px}.section-caption{margin-bottom:8px;font-size:9px}.launch-row{margin-top:12px;gap:20px}.callsign-field input{padding:4px 0}.play-button{padding:12px 18px;min-width:215px;font-size:13px}.launch-note{font-size:11px}.lobby>footer{font-size:9px}}
</style>
