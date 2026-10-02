<script setup lang="ts">
interface InstallEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>
}
const route = useRoute()
const inMatch = computed(() => /^\/play(?:\/|$)/.test(route.path))
const installed = ref(false), updateReady = ref(false), updating = ref(false), offline = ref(false), help = ref(false), message = ref('')
let registration: ServiceWorkerRegistration | undefined, installEvent: InstallEvent | undefined, reloadRequested = false
function connection() { offline.value = !navigator.onLine }
function offered(event: Event) { event.preventDefault(); installEvent = event as InstallEvent }
function installedApp() { installed.value = true; installEvent = undefined; help.value = false }
function controllerChanged() {
  // Never automatically reload a match, even if it began while an update was activating.
  if (reloadRequested && !/^\/play(?:\/|$)/.test(location.pathname)) location.reload()
}
async function install() {
  if (!installEvent) { help.value = !help.value; return }
  try { await installEvent.prompt(); await installEvent.userChoice }
  finally { installEvent = undefined }
}
async function update() {
  if (inMatch.value || !registration?.waiting || updating.value) return
  updating.value = true; message.value = ''; reloadRequested = true
  const worker = registration.waiting
  try {
    const result = await new Promise<{blocked:boolean}>((resolve, reject) => {
      const channel = new MessageChannel()
      const timeout = window.setTimeout(() => {channel.port1.close(); reject(new Error('timeout'))}, 8000)
      channel.port1.onmessage = event => {clearTimeout(timeout); channel.port1.close(); resolve(event.data)}
      worker.postMessage({type: 'APPLY_UPDATE'}, [channel.port2])
    })
    if (result.blocked) {reloadRequested = false; message.value = 'Finish or leave your other open match first.'}
  } catch {reloadRequested = false; message.value = 'Update unavailable. Try again when connected.'}
  finally {updating.value = false}
}
function checkUpdate() {
  if (!document.hidden && !inMatch.value && navigator.onLine) void registration?.update().catch(() => {})
}
onMounted(async () => {
  installed.value = matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & {standalone?:boolean}).standalone)
  connection()
  window.addEventListener('online', connection); window.addEventListener('offline', connection)
  window.addEventListener('beforeinstallprompt', offered); window.addEventListener('appinstalled', installedApp)
  document.addEventListener('visibilitychange', checkUpdate)
  if (import.meta.dev || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.addEventListener('controllerchange', controllerChanged)
  try {
    registration = await navigator.serviceWorker.register('/sw.js', {scope: '/', updateViaCache: 'none'})
    updateReady.value = Boolean(registration.waiting)
    registration.addEventListener('updatefound', () => {
      const worker = registration?.installing
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) updateReady.value = true
      })
    })
  } catch { /* The ordinary browser game still works if service workers are unavailable. */ }
})
onBeforeUnmount(() => {
  window.removeEventListener('online', connection); window.removeEventListener('offline', connection)
  window.removeEventListener('beforeinstallprompt', offered); window.removeEventListener('appinstalled', installedApp)
  document.removeEventListener('visibilitychange', checkUpdate)
  navigator.serviceWorker?.removeEventListener('controllerchange', controllerChanged)
})
</script>

<template>
  <aside v-if="!inMatch && (!installed || updateReady || offline)" class="pwa-controls" aria-label="Crossline app" data-ui-action>
    <p v-if="offline" role="status">You’re offline. Matches need an internet connection.</p>
    <p v-if="message" role="status">{{ message }}</p>
    <div class="pwa-actions">
      <button v-if="!installed" @click="install">Install app</button>
      <button v-if="updateReady" :disabled="updating || offline" @click="update">{{ updating ? 'Updating…' : 'Update app' }}</button>
    </div>
    <div v-if="help" class="pwa-help" role="note">
      <p>On iPhone or iPad, open in Safari, tap Share, then Add to Home Screen. On desktop or Android, choose Install app in your browser’s menu.</p>
      <p>All game modes need internet. Installation keeps Crossline in its own window.</p>
      <button @click="help=false">Close instructions</button>
    </div>
  </aside>
</template>

<style scoped>
.pwa-controls{position:fixed;right:calc(18px + env(safe-area-inset-right));bottom:calc(68px + env(safe-area-inset-bottom));z-index:15;max-width:min(320px,calc(100vw - 36px));color:#edf1ef;font:12px/1.5 Arial,sans-serif}
.pwa-actions{display:flex;gap:8px;justify-content:flex-end}.pwa-controls button{border:1px solid #ffffff40;background:#142026;padding:9px 14px;color:#ffb15c;font-weight:700;cursor:pointer}.pwa-controls button:focus-visible{outline:2px solid #ffb15c;outline-offset:3px}.pwa-controls button:disabled{opacity:.5;cursor:wait}.pwa-help,.pwa-controls>p{background:#142026;padding:14px;border:1px solid #ffffff25;margin-bottom:8px}.pwa-help p{margin:0 0 12px}.pwa-help{margin-top:8px}
@media(max-width:900px){.pwa-controls{position:relative;right:auto;bottom:auto;margin:12px max(18px,env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) auto;max-width:calc(100vw - 36px)}}
</style>
