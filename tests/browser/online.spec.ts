import { browserAccount } from './accounts'
import { expect, test, type Page } from '@playwright/test'
async function setup(page: Page, name: string) {
  await browserAccount(page, name)
  await page.addInitScript((name) => {
    localStorage.setItem('crossline.callsign', name)
    const pad = {
      id: 'Online acceptance controller',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })),
    }
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true })
    const sockets: WebSocket[] = []
    ;(window as unknown as { testSockets: WebSocket[] }).testSockets = sockets
    const Original = window.WebSocket
    window.WebSocket = class extends Original {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols)
        sockets.push(this)
      }
    }
  }, name)
  await page.goto('/play?mode=online')
  await expect(page.locator('.radar-panel')).toContainText('Connected', { timeout: 30000 })
  await expect(page.getByRole('heading', { name: 'Join the free-for-all.' })).toBeVisible()
}
async function button(page: Page, index: number, pressed: boolean) {
  await page.evaluate(
    ({ index, pressed }) => {
      Object.defineProperty(navigator.getGamepads()[0]!.buttons[index], 'pressed', {
        value: pressed,
        configurable: true,
      })
    },
    { index, pressed },
  )
}
async function pulse(page: Page, index: number) {
  await page.bringToFront()
  await button(page, index, true)
  await page.waitForTimeout(100)
  await button(page, index, false)
  await page.waitForTimeout(100)
}
test('two browser players share FFA, pause locally, reconnect and leave using controller menus', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(90000)
  const context = await browser.newContext(),
    other = await context.newPage(),
    errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  other.on('pageerror', (e) => errors.push(e.message))
  try {
    await setup(page, 'ALPHA')
    await pulse(page, 0)
    await expect(page.locator('main.arena')).toHaveAttribute('data-phase', 'playing')
    await setup(other, 'BRAVO')
    await pulse(other, 0)
    await expect(other.locator('main.arena')).toHaveAttribute('data-phase', 'playing')
    await expect(page.locator('[data-actor]')).toHaveCount(2)
    await expect(other.locator('[data-actor]')).toHaveCount(2)
    const room = await page.locator('main.arena').getAttribute('data-room-id')
    expect(room).toBeTruthy()
    await expect(other.locator('main.arena')).toHaveAttribute('data-room-id', room!)
    const identity = await page.locator('main.arena').getAttribute('data-player-id')
    await page.bringToFront()
    if ((await page.locator('main.arena').getAttribute('data-phase')) === 'playing')
      await pulse(page, 9)
    await expect(page.getByRole('heading', { name: 'Match continues.' })).toBeVisible()
    await expect(page.locator('main.arena')).toHaveAttribute('data-server-phase', 'playing')
    await expect(page.getByTestId('online-session')).toContainText('alpha')
    await expect(page.getByRole('list', { name: 'Match standings' })).toContainText('bravo')
    await pulse(page, 8)
    await expect(page.getByRole('dialog', { name: 'Arena leaders' })).toBeVisible()
    await pulse(page, 1)
    await expect(page.getByRole('dialog', { name: 'Arena leaders' })).toBeHidden()
    await button(page, 0, true)
    await expect(page.locator('main.arena')).toHaveAttribute('data-phase', 'playing')
    await page.waitForTimeout(500)
    await expect(page.getByTestId('ammo')).toContainText('24 /')
    await button(page, 0, false)
    await page.waitForTimeout(150)
    await button(page, 0, true)
    await expect(page.getByTestId('ammo')).not.toContainText('24 /')
    await button(page, 0, false)
    await expect(page.getByTestId('grenade-count')).toContainText('2 GRENADES')
    await pulse(page, 5)
    await expect(page.getByTestId('grenade-count')).toContainText('1 GRENADES')
    await page.screenshot({ path: info.outputPath('online-playing.png') })
    await page.evaluate(() => {
      const sockets = (window as unknown as { testSockets: WebSocket[] }).testSockets
      sockets.find((s) => s.readyState === WebSocket.OPEN)!.close()
    })
    await expect(page.locator('.radar-panel')).toContainText('Reconnecting')
    await expect(page.locator('.radar-panel')).toContainText('Connected', { timeout: 15000 })
    await expect(page.locator('main.arena')).toHaveAttribute('data-player-id', identity!)
    await expect(page.getByRole('heading', { name: 'Match continues.' })).toBeVisible()
    await expect(other.locator('[data-actor]')).toHaveCount(2)
    await page.screenshot({ path: info.outputPath('online-reconnected.png') })
    await page.reload()
    await expect(page.locator('.radar-panel')).toContainText('Connected', { timeout: 30000 })
    await expect(page.locator('main.arena')).toHaveAttribute('data-player-id', identity!)
    await expect(other.locator('[data-actor]')).toHaveCount(2)
    // D-pad selection must survive ongoing shared-state patches while the local menu is open.
    await pulse(page, 13)
    await page.waitForTimeout(350)
    await expect(page.getByRole('button', { name: 'Return to menu', exact: true })).toHaveClass(
      /selected/,
    )
    await pulse(page, 0)
    await expect(page).toHaveURL('/')
    await expect(other.locator('[data-actor]')).toHaveCount(1)
    await expect(other.locator('main.arena')).toHaveAttribute('data-server-phase', 'playing')
    expect(errors).toEqual([])
  } finally {
    await context.close()
  }
})
