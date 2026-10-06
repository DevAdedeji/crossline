/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null; bytes?: number }>
}
declare const __CROSSLINE_RELEASE__: string

const release = { release: __CROSSLINE_RELEASE__ }.release
const manifest = self.__WB_MANIFEST as Array<{
  url: string
  revision: string | null
  bytes?: number
}>
const pack = manifest.filter(
  (entry) =>
    !['offline.html', 'manifest.webmanifest'].includes(entry.url) &&
    !entry.url.startsWith('icons/'),
)
const packCache = 'crossline-offline-' + release,
  readyKey = '/_offline/ready'
const MAX_PACK = 64 * 1024 * 1024,
  MAX_FILE = 8 * 1024 * 1024,
  MAX_FILES = 96
// Small reconnect page/icons install automatically; game files require an explicit download.
cleanupOutdatedCaches()
precacheAndRoute(manifest.filter((entry) => !pack.includes(entry)))
clientsClaim()

async function ready() {
  const cache = await caches.open(packCache)
  if (!(await cache.match(readyKey))) return false
  for (const entry of pack) if (!(await cache.match('/' + entry.url))) return false
  return pack.some((entry) => entry.url === 'offline-shell/index.html')
}
const assetPaths = new Set(pack.map((entry) => '/' + entry.url))
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    assetPaths.has(url.pathname) &&
    !url.search,
  async ({ request }) => {
    // A completed pack pins code and art together until an explicit app update.
    if (await ready()) {
      const saved = await (await caches.open(packCache)).match(new URL(request.url).pathname)
      if (saved) return saved
    }
    return fetch(request)
  },
)
registerRoute(
  ({ request, url }) =>
    request.mode === 'navigate' &&
    url.origin === self.location.origin &&
    !/^\/api(?:\/|$)/.test(url.pathname),
  async ({ request, url }) => {
    if (
      (url.pathname === '/' ||
        url.pathname === '/play' ||
        url.pathname === '/campaign' ||
        url.pathname === '/offline-shell') &&
      (await ready())
    )
      return (await (await caches.open(packCache)).match('/offline-shell/index.html'))!
    try {
      return await fetch(request)
    } catch {
      return (await matchPrecache('/offline.html')) ?? Response.error()
    }
  },
)

let downloading: AbortController | undefined
async function download(port: MessagePort) {
  if (downloading) {
    port.postMessage({ error: 'A download is already running in another tab.' })
    return
  }
  if (
    !pack.some((entry) => entry.url === 'offline-shell/index.html') ||
    pack.length > MAX_FILES ||
    pack.reduce((n, e) => n + (e.bytes ?? MAX_PACK), 0) > MAX_PACK
  ) {
    port.postMessage({ error: 'This release cannot be downloaded. Reconnect and update the app.' })
    return
  }
  const controller = new AbortController()
  downloading = controller
  const cache = await caches.open(packCache)
  let bytes = 0,
    done = 0
  await cache.delete(readyKey)
  const deadline = setTimeout(() => controller.abort(), 5 * 60 * 1000)
  try {
    for (const entry of pack) {
      if (controller.signal.aborted) throw new Error('Download stopped. Retry to resume.')
      const url = '/' + entry.url
      let response = await cache.match(url)
      if (!response) {
        const timeout = setTimeout(() => controller.abort(), 45000)
        try {
          response = await fetch(
            entry.url === 'offline-shell/index.html' ? '/offline-shell' : url,
            { credentials: 'omit', cache: 'no-store', signal: controller.signal },
          )
          if (!response.ok || response.redirected)
            throw new Error('A game file is unavailable. Retry when connected.')
          const body = await response.clone().arrayBuffer()
          if (body.byteLength > MAX_FILE || body.byteLength !== entry.bytes)
            throw new Error('Game files changed. Update the app before downloading.')
          const hash = Array.from(
            new Uint8Array(await crypto.subtle.digest('SHA-256', body)),
            (b) => b.toString(16).padStart(2, '0'),
          ).join('')
          if (hash !== entry.revision)
            throw new Error('Game files changed. Update the app before downloading.')
          await cache.put(url, response.clone())
        } finally {
          clearTimeout(timeout)
        }
      }
      bytes += entry.bytes!
      done++
      if (bytes > MAX_PACK) throw new Error('Download exceeds the storage limit.')
      port.postMessage({
        done,
        total: pack.length,
        bytes,
        totalBytes: pack.reduce((n, e) => n + e.bytes!, 0),
        ready: false,
      })
    }
    if (controller.signal.aborted) throw new Error('Download interrupted.')
    await cache.put(readyKey, new Response(release))
    port.postMessage({ done, total: pack.length, bytes, ready: await ready() })
  } catch (error) {
    port.postMessage({
      ready: false,
      error: controller.signal.aborted
        ? 'Download interrupted. Retry to resume saved files.'
        : error instanceof Error
          ? error.message
          : 'Storage unavailable. Free space and retry.',
    })
  } finally {
    clearTimeout(deadline)
    downloading = undefined
  }
}
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith('crossline-offline-') && name !== packCache) await caches.delete(name)
    })(),
  ),
)

// Ordinary visits keep a small code cache; the explicit offline pack is separate and bounded.
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    url.pathname.startsWith('/_nuxt/') &&
    /\.(js|css)$/.test(url.pathname) &&
    !url.search,
  new CacheFirst({
    cacheName: 'crossline-code-v1',
    fetchOptions: { credentials: 'omit' },
    plugins: [
      {
        async cacheWillUpdate({ response }) {
          if (
            response.status !== 200 ||
            !/(javascript|text\/css)/i.test(response.headers.get('content-type') ?? '')
          )
            return null
          const maxBytes = 3 * 1024 * 1024
          if (Number(response.headers.get('content-length')) > maxBytes) return null
          return (await response.clone().arrayBuffer()).byteLength <= maxBytes ? response : null
        },
      },
      new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 7 * 86400, purgeOnQuotaError: true }),
    ],
  }),
)

// Updates wait by default. Even a request from a menu tab is rejected while
// another Crossline tab is on the play route (including pause/reconnect).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_RELEASE') {
    event.ports[0]?.postMessage({ release })
    return
  }
  const type = event.data?.type,
    port = event.ports[0]
  if (type === 'OFFLINE_STATUS') {
    event.waitUntil(
      ready().then((value) =>
        port?.postMessage({
          ready: value,
          total: pack.length,
          totalBytes: pack.reduce((n, e) => n + (e.bytes ?? 0), 0),
        }),
      ),
    )
    return
  }
  if (type === 'OFFLINE_DOWNLOAD' && port) {
    event.waitUntil(download(port))
    return
  }
  if (type === 'OFFLINE_CANCEL') {
    downloading?.abort()
    return
  }
  if (type === 'OFFLINE_REMOVE') {
    event.waitUntil(
      (async () => {
        const windows = await self.clients.matchAll({ type: 'window' })
        if (downloading || windows.some((c) => new URL(c.url).pathname === '/play')) {
          port?.postMessage({ error: 'Close open matches and downloads before removing files.' })
          return
        }
        await caches.delete(packCache)
        port?.postMessage({ ready: false })
      })(),
    )
    return
  }
  if (type !== 'APPLY_UPDATE') return
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (windows.some((client) => /^\/play(?:\/|$)/.test(new URL(client.url).pathname))) {
        event.ports[0]?.postMessage({ blocked: true })
        return
      }
      event.ports[0]?.postMessage({ blocked: false })
      await self.skipWaiting()
    })(),
  )
})
