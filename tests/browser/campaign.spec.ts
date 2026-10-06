import { CAMPAIGN_GUARDS, EXTRACTION_MISSION } from '../../packages/shared/src/campaign'
import { test, expect, type Page } from '@playwright/test'
const key = 'crossline.campaign.last-signal.v1'
const checkpoint = {
  version: 1,
  checkpoint: 'rescue',
  cleared: CAMPAIGN_GUARDS.map((_, i) => `bot-${i}`),
  completed: false,
  elapsedMs: 18000,
}
async function seed(page: Page) {
  await page.goto('/')
  await page.evaluate(
    ({ key, checkpoint }) => localStorage.setItem(key, JSON.stringify(checkpoint)),
    { key, checkpoint },
  )
}
async function coordinate(page: Page, axis: 'x' | 'z') {
  const id = await page.locator('main.arena').getAttribute('data-player-id')
  return Number(await page.locator(`[data-actor="${id}"]`).getAttribute(`data-${axis}`))
}

test('Campaign briefing, saved checkpoint, automatic rescue and retry work on desktop', async ({
  page,
}, info) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await seed(page)
  await page.getByRole('button', { name: 'Campaign', exact: true }).click()
  await expect(page).toHaveURL('/campaign')
  await page.getByRole('button', { name: 'The last signal', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('.objective').filter({ hasText: 'Recover Finch' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('campaign-briefing.png') })
  await page.getByRole('button', { name: 'Got it, continue' }).click()
  await expect(page.locator('.radar-panel')).toContainText('Connected', { timeout: 30000 })
  await expect(page.getByRole('button', { name: 'Start mission', exact: true })).toBeHidden()
  await expect(page.locator('.mission-hud')).toHaveAttribute('data-stage', 'rescue')
  await expect(page.locator('[data-waypoint=finch]')).toBeVisible()
  await expect(page.getByRole('button', { name: /LEADERBOARD/ })).toHaveCount(0)
  await page.keyboard.down('d')
  await expect
    .poll(() => coordinate(page, 'x'), { timeout: 10000, intervals: [30] })
    .toBeGreaterThan(EXTRACTION_MISSION.captive.x - 0.7)
  await page.keyboard.up('d')
  await page.keyboard.down('w')
  await expect(page.locator('.mission-interact')).toBeVisible()
  await page.keyboard.up('w')
  await expect(page.locator('.mission-hud')).toHaveAttribute('data-stage', 'extract')
  await expect(page.locator('[data-waypoint=extraction]')).toBeVisible()
  await expect(page.locator('[data-waypoint=extraction]')).toHaveAttribute('data-edge', 'true')
  await expect
    .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).checkpoint, key))
    .toBe('extract')
  await page.screenshot({ path: info.outputPath('campaign-escort.png') })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Abort mission', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Contact lost.' })).toBeVisible()
  await page.getByRole('button', { name: 'Retry checkpoint', exact: true }).click()
  await expect(page.locator('.mission-hud')).toHaveAttribute('data-stage', 'extract')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Return to menu', exact: true }).click()
  expect(errors).toEqual([])
})

test('Campaign mobile briefing fits portrait and automatic touch rescue works in landscape', async ({
  browser,
}, info) => {
  test.setTimeout(90000)
  const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:3001',
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    }),
    page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  try {
    await seed(page)
    await page.goto('/campaign')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'The last signal', exact: true }).tap()
    await page.screenshot({ path: info.outputPath('campaign-portrait.png') })
    await page.getByRole('button', { name: 'Got it, continue' }).tap()
    await expect(page.getByRole('dialog', { name: 'Rotate phone' })).toBeVisible()
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(page.locator('.radar-panel')).toContainText('Connected', { timeout: 30000 })
    await expect(page.getByRole('button', { name: 'Start mission', exact: true })).toBeHidden()
    await expect(page.locator('.mission-hud')).toHaveAttribute('data-stage', 'rescue')
    await expect(page.locator('[data-waypoint=finch]')).toBeVisible()
    const cdp = await context.newCDPSession(page)
    const stick = (await page.getByTestId('touch-move').boundingBox())!
    async function move(x: number, y: number) {
      const center = { id: 1, x: stick.x + stick.width / 2, y: stick.y + stick.height / 2 }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [center] })
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ ...center, x: center.x + x, y: center.y + y }],
      })
    }
    const stop = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await move(45, 0)
    await expect
      .poll(() => coordinate(page, 'x'), { timeout: 12000, intervals: [30] })
      .toBeGreaterThan(EXTRACTION_MISSION.captive.x - 0.7)
    await stop()
    await move(0, -45)
    await expect(page.locator('.mission-interact')).toBeVisible()
    await stop()
    await expect(page.locator('.mission-hud')).toHaveAttribute('data-stage', 'extract')
    await expect(page.locator('[data-waypoint=extraction]')).toBeVisible()
    const hud = (await page.locator('.mission-hud').boundingBox())!
    expect(hud.x).toBeGreaterThan(90)
    expect(hud.x + hud.width).toBeLessThan(844)
    await page.screenshot({ path: info.outputPath('campaign-mobile.png') })
    await page.getByRole('button', { name: 'Pause', exact: true }).tap()
    await page.getByRole('button', { name: 'Return to menu', exact: true }).tap()
    expect(errors).toEqual([])
  } finally {
    await context.close()
  }
})

test('Campaign guards engage on sight while the player has not fired', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/play?mode=campaign')
  await expect(page.locator('.radar-panel')).toContainText('Connected', { timeout: 30000 })
  await page.getByRole('button', { name: 'Start mission', exact: true }).click()
  await expect(page.locator('[data-waypoint=relay]')).toBeVisible()
  await expect(page.locator('[data-waypoint=finch]')).toBeVisible()
  await expect
    .poll(async () => Number((await page.getByTestId('health').innerText()).split('/')[0]), {
      timeout: 15000,
    })
    .toBeLessThan(100)
  await expect(page.getByTestId('ammo')).toContainText('24 /')
  await page.screenshot({ path: info.outputPath('campaign-guard-contact.png') })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Return to menu', exact: true }).click()
  expect(errors).toEqual([])
})
