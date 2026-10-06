import { test, expect, type Page } from '@playwright/test'
import { createServer, request as httpRequest } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'

async function controlled(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      )
  })
}
async function cachedUrls(page: Page) {
  return page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (key) =>
          (await (await caches.open(key)).keys()).map((r) => r.url),
        ),
      )
    ).flat(),
  )
}

test('install manifest, bounded static cache, offline fallback and API exclusion', async ({
  page,
  context,
}) => {
  test.setTimeout(90000)
  await page.goto('/')
  await controlled(page)
  const manifest = await (await page.request.get('/manifest.webmanifest')).json()
  expect(manifest).toMatchObject({
    id: '/',
    name: 'Crossline',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    orientation: 'landscape',
  })
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true)
  for (const icon of manifest.icons)
    expect(
      await page.evaluate(async (src) => {
        const image = new Image()
        image.src = src
        await image.decode()
        return image.naturalWidth
      }, icon.src),
    ).toBe(Number(icon.sizes.split('x')[0]))
  expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe(
    '/icons/apple-touch-icon.png',
  )
  const cdp = await context.newCDPSession(page)
  const eligibility = await cdp.send('Page.getInstallabilityErrors')
  // Playwright's isolated contexts cannot install OS apps; all app-specific checks must pass.
  expect(
    eligibility.installabilityErrors.filter(
      (error: { errorId: string }) => error.errorId !== 'in-incognito',
    ),
  ).toEqual([])
  await page.evaluate(async () => {
    await fetch('/api/auth/get-session')
    await fetch('/api/arena')
  })
  const chunks = (await readdir('apps/web/.output/public/_nuxt'))
    .filter((f) => f.endsWith('.js'))
    .slice(0, 44)
  await page.evaluate(async (chunks) => {
    for (const chunk of chunks) await (await fetch('/_nuxt/' + chunk)).arrayBuffer()
  }, chunks)
  await expect
    .poll(() =>
      page.evaluate(async () => (await (await caches.open('crossline-code-v1')).keys()).length),
    )
    .toBeLessThanOrEqual(32)
  const urls = await cachedUrls(page)
  expect(urls.length).toBeGreaterThan(5)
  expect(urls.some((u) => new URL(u).pathname.startsWith('/api/'))).toBe(false)
  expect(urls.some((u) => new URL(u).pathname === '/')).toBe(false)
  expect(urls.some((u) => new URL(u).pathname.endsWith('.glb'))).toBe(false)
  await context.setOffline(true)
  await page.goto('/play?mode=online')
  await expect(page.getByRole('heading', { name: 'You’re offline.' })).toBeVisible()
  await expect(page.getByText(/Offline game files are not ready/)).toBeVisible()
  expect(
    await page.evaluate(async () => {
      try {
        await fetch('/api/auth/get-session')
        return 'cached'
      } catch {
        return 'network-only'
      }
    }),
  ).toBe('network-only')
  await context.setOffline(false)
  await page.getByRole('link', { name: 'Try again' }).click()
  await expect(page.getByRole('button', { name: 'Campaign', exact: true })).toBeVisible()
})

test('a waiting worker cannot update a match tab and never reloads it', async ({ browser }) => {
  test.setTimeout(90000)
  let revision = 1
  const code = await readFile('apps/web/.output/public/sw.js', 'utf8')
  // Serve two real worker revisions without modifying the build or a deployment.
  const proxy = createServer((request, response) => {
    if (request.url?.startsWith('/_nuxt/cache-fixture-')) {
      response.writeHead(200, { 'content-type': 'text/javascript' })
      response.end(
        request.url.includes('oversize')
          ? ' '.repeat(3 * 1024 * 1024 + 1)
          : 'export const fixture=true;',
      )
      return
    }
    if (request.url === '/sw.js') {
      response.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' })
      response.end(code + `\n/* browser update fixture ${revision} */`)
      return
    }
    if (request.url === '/play?update-fixture') {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('<!doctype html><title>Open match route</title><h1>Match route held open</h1>')
      return
    }
    const upstream = httpRequest(
      {
        hostname: '127.0.0.1',
        port: 3001,
        path: request.url,
        method: request.method,
        headers: { ...request.headers, host: '127.0.0.1:3001' },
      },
      (remote) => {
        response.writeHead(remote.statusCode ?? 502, remote.headers)
        remote.pipe(response)
      },
    )
    upstream.on('error', () => {
      response.writeHead(502)
      response.end()
    })
    request.pipe(upstream)
  })
  await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
  const port = (proxy.address() as { port: number }).port,
    base = `http://127.0.0.1:${port}`
  const context = await browser.newContext(),
    menu = await context.newPage()
  try {
    await menu.goto(base)
    await controlled(menu)
    await menu.evaluate(async () => {
      for (let i = 0; i < 40; i++) await (await fetch(`/_nuxt/cache-fixture-${i}.js`)).arrayBuffer()
    })
    await expect
      .poll(() =>
        menu.evaluate(async () => (await (await caches.open('crossline-code-v1')).keys()).length),
      )
      .toBe(32)
    await menu.evaluate(async () => {
      await (await fetch('/_nuxt/cache-fixture-oversize.js')).arrayBuffer()
    })
    expect(
      await menu.evaluate(async () =>
        Boolean(
          await (await caches.open('crossline-code-v1')).match('/_nuxt/cache-fixture-oversize.js'),
        ),
      ),
    ).toBe(false)
    const match = await context.newPage()
    await match.goto(base + '/play?mode=campaign&update-fixture')
    const matchTime = await match.evaluate(() => performance.timeOrigin),
      menuTime = await menu.evaluate(() => performance.timeOrigin)
    await menu.evaluate(async () => {
      await (
        await caches.open('crossline-offline-obsolete-fixture')
      ).put('/models/old.glb', new Response('old asset'))
    })
    revision = 2
    await menu.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())!.update()
    })
    await expect(menu.getByRole('button', { name: 'Update app', exact: true })).toBeVisible()
    expect(await menu.evaluate(() => performance.timeOrigin)).toBe(menuTime)
    await menu.getByRole('button', { name: 'Update app', exact: true }).click()
    await expect(menu.getByText('Finish or leave your other open match first.')).toBeVisible()
    expect(await match.evaluate(() => performance.timeOrigin)).toBe(matchTime)
    expect(
      await menu.evaluate(async () =>
        Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
      ),
    ).toBe(true)
    await match.close()
    const reloaded = menu.waitForEvent('domcontentloaded')
    await menu.getByRole('button', { name: 'Update app', exact: true }).click()
    await reloaded
    expect(await menu.evaluate(() => performance.timeOrigin)).not.toBe(menuTime)
    await expect
      .poll(() =>
        menu.evaluate(async () =>
          Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
        ),
      )
      .toBe(false)
    await expect(menu.getByRole('button', { name: 'Campaign', exact: true })).toBeVisible()
    expect(await menu.evaluate(() => caches.has('crossline-offline-obsolete-fixture'))).toBe(false)
  } finally {
    await context.close()
    await new Promise<void>((resolve) => proxy.close(() => resolve()))
  }
})
