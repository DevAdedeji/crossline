/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{url:string; revision:string|null}> }
declare const __CROSSLINE_RELEASE__: string

// Only the small offline page and icons are precached. Never store an HTML
// session, account response, leaderboard, matchmaking request or game state.
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()

registerRoute(({request, url}) => request.mode === 'navigate' && url.origin === self.location.origin
  && !/^\/api(?:\/|$)/.test(url.pathname), async ({request}) => {
  try { return await fetch(request) }
  catch { return (await matchPrecache('/offline.html')) ?? Response.error() }
})

// Hashed Nuxt JS/CSS only. Models remain under normal HTTP caching, so a new
// server map can never be paired with a stale service-worker model cache.
registerRoute(({request, url}) => request.method === 'GET' && url.origin === self.location.origin
  && url.pathname.startsWith('/_nuxt/') && /\.(js|css)$/.test(url.pathname) && !url.search,
new CacheFirst({
  cacheName: 'crossline-code-v1',
  fetchOptions: {credentials: 'omit'},
  plugins: [{async cacheWillUpdate({response}) {
    if (response.status !== 200 || !/(javascript|text\/css)/i.test(response.headers.get('content-type') ?? '')) return null
    const maxBytes = 3 * 1024 * 1024
    if (Number(response.headers.get('content-length')) > maxBytes) return null
    return (await response.clone().arrayBuffer()).byteLength <= maxBytes ? response : null
  }}, new ExpirationPlugin({maxEntries: 32, maxAgeSeconds: 7 * 86400, purgeOnQuotaError: true})],
}))

// Updates wait by default. Even a request from a menu tab is rejected while
// another Crossline tab is on the play route (including pause/reconnect).
self.addEventListener('message', event => {
  if (event.data?.type === 'GET_RELEASE') {
    event.ports[0]?.postMessage({release: __CROSSLINE_RELEASE__}); return
  }
  if (event.data?.type !== 'APPLY_UPDATE') return
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true})
    if (windows.some(client => /^\/play(?:\/|$)/.test(new URL(client.url).pathname))) {
      event.ports[0]?.postMessage({blocked: true}); return
    }
    event.ports[0]?.postMessage({blocked: false})
    await self.skipWaiting()
  })())
})
