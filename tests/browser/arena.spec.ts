import { expect, test } from '@playwright/test'

test('mode menu, arena connection, mouse capture, movement and cleanup', async ({ page, context }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') console.error(message.text()) })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('PLAY')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('button', { name: 'Squads — in development' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toContainText('Squads is in development')
  await expect(page).toHaveURL('/')
  await page.screenshot({ path: testInfo.outputPath('menu.png'), fullPage: true })
  await page.getByRole('link', { name: 'Enter training' }).click()
  await expect(page.getByRole('status')).toContainText('Connected')
  await expect(page.locator('canvas')).toBeVisible()
  const second = await context.newPage()
  second.on('pageerror', (error) => { errors.push(error.message); console.error('Second tab:', error.message) })
  second.on('console', (message) => { if (message.type() === 'error') console.error(message.text()) })
  await second.goto('/play')
  await expect(second.getByRole('status')).toContainText('Connected', { timeout: 20000 })
  await expect(page.getByRole('status')).toContainText('2 / 8 PLAYERS')
  await second.close()
  await expect(page.getByRole('status')).toContainText('1 / 8 PLAYERS')
  const initial = await page.getByTestId('position').innerText()
  await page.getByRole('button', { name: 'Take control' }).click()
  await expect(page.locator('.crosshair')).toBeVisible()
  await page.keyboard.down('KeyW')
  await expect(page.getByTestId('position')).not.toHaveText(initial)
  await expect.poll(async () => Number((await page.getByTestId('position').innerText()).split(' / ')[1])).toBeGreaterThan(-15)
  await page.waitForTimeout(500) // Keep holding forward against the visible parked car.
  const blocked = await page.getByTestId('position').innerText()
  expect(Number(blocked.split(' / ')[1])).toBeLessThanOrEqual(-14.6)
  await page.waitForTimeout(250)
  await expect(page.getByTestId('position')).toHaveText(blocked)
  await page.keyboard.up('KeyW')
  const beforeMouseLook = await page.getByTestId('heading').innerText()
  await page.mouse.move(1150, 320)
  await expect(page.getByTestId('heading')).not.toHaveText(beforeMouseLook)
  const rightView = await page.getByTestId('heading').innerText()
  await page.mouse.move(100, 320)
  await expect(page.getByTestId('heading')).not.toHaveText(rightView)
  await page.screenshot({ path: testInfo.outputPath('arena.png') })
  await page.keyboard.press('Escape')
  await expect(page.locator('.crosshair')).toBeHidden()
  await page.getByRole('link', { name: 'Leave arena' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('PLAY')
  expect(errors).toEqual([])
})

test('standard gamepad moves, looks, pauses, and handles disconnection and unsupported mapping', async ({ page }) => {
  await page.addInitScript(() => {
    const pad = { id: 'Simulated standard controller', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })) }
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true })
  })
  await page.goto('/')
  await expect(page.getByTestId('menu-controller')).toContainText('GAMEPAD CONNECTED')
  async function pulse(index: number) {
    await page.evaluate(async (buttonIndex) => {
      const button = navigator.getGamepads()[0]!.buttons[buttonIndex]!
      Object.defineProperty(button, 'pressed', { value: true, configurable: true })
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      Object.defineProperty(button, 'pressed', { value: false })
    }, index)
  }
  await pulse(14)
  await expect(page.getByRole('button', { name: 'Squads — in development' })).toBeFocused()
  await pulse(15)
  await expect(page.getByRole('button', { name: 'Training — playable' })).toBeFocused()
  await pulse(0)
  await expect(page).toHaveURL('/play')
  await page.evaluate(() => { Object.defineProperty(navigator.getGamepads()[0]!.buttons[0], 'pressed', { value: false }); Object.defineProperty(navigator.getGamepads()[0]!.buttons[1], 'pressed', { value: true, configurable: true }) })
  await expect(page.getByRole('status')).toContainText('Connected')
  await expect(page.locator('.crosshair')).toBeHidden()
  await page.evaluate(() => { Object.defineProperty(navigator.getGamepads()[0]!.buttons[1], 'pressed', { value: false }) })
  await expect(page.getByTestId('gamepad-status')).toContainText('standard mapping')
  const initial = await page.getByTestId('position').innerText()
  await page.getByRole('button', { name: 'Use gamepad' }).click()
  await expect(page.locator('.crosshair')).toBeVisible()
  await page.evaluate(() => { (navigator.getGamepads()[0]!.axes as number[])[1] = -1 })
  await expect(page.getByTestId('position')).not.toHaveText(initial)
  const beforeTurn = (await page.getByTestId('position').innerText()).split(' / ')[0]
  await page.evaluate(() => { (navigator.getGamepads()[0]!.axes as number[])[2] = 1 })
  await expect.poll(async () => (await page.getByTestId('position').innerText()).split(' / ')[0]).not.toBe(beforeTurn)
  await page.evaluate(() => { Object.defineProperty(navigator.getGamepads()[0]!.buttons[1], 'pressed', { value: true, configurable: true }) })
  await expect(page.locator('.crosshair')).toBeHidden()
  await page.evaluate(() => { Object.defineProperty(navigator.getGamepads()[0], 'connected', { value: false, configurable: true }); window.dispatchEvent(new Event('gamepaddisconnected')) })
  await expect(page.getByTestId('gamepad-status')).toContainText('disconnected')
  await expect(page.getByRole('button', { name: 'Use gamepad' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Take control' })).toBeEnabled()
  await page.evaluate(() => { const pad = navigator.getGamepads()[0]!; Object.defineProperty(pad, 'connected', { value: true }); Object.defineProperty(pad, 'mapping', { value: '' }) })
  await expect(page.getByTestId('gamepad-status')).toContainText('Unsupported controller mapping')
})

test('keyboard route reaches the cafe rooftop and returns through its doorway', async ({ page }, testInfo) => {
  test.setTimeout(65000)
  await page.addInitScript(() => {
    const pad = { id: 'Rooftop test pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] })
  })
  await page.goto('/play')
  await expect(page.getByRole('status')).toContainText('Connected')
  await page.getByRole('button', { name: 'Take control' }).click()
  await expect(page.locator('.crosshair')).toBeVisible()
  await expect(page.getByTestId('position')).not.toHaveText('0.0 / 0.0')
  async function position() { return (await page.getByTestId('position').innerText()).split(' / ').map(Number) }
  async function axisTo(axis: 0 | 1, target: number) {
    const start = (await position())[axis]!
    const positive = target > start
    const key = axis === 0 ? positive ? 'KeyD' : 'KeyA' : positive ? 'KeyW' : 'KeyS'
    await page.keyboard.down(key)
    try {
      await expect.poll(async () => {
        const value = (await position())[axis]!
        return positive ? value >= target - 0.1 : value <= target + 0.1
      }, { intervals: [20], timeout: 10000 }).toBe(true)
    } finally { await page.keyboard.up(key) }
    let last = ''; let settled = 0
    await expect.poll(async () => {
      const current = await page.getByTestId('position').innerText()
      settled = current === last ? settled + 1 : 0; last = current
      return settled
    }, { intervals: [40], timeout: 1500 }).toBeGreaterThanOrEqual(2)
  }
  await axisTo(0, -21)
  await axisTo(1, -20)
  await axisTo(0, -24)
  await axisTo(1, 5.1)
  await axisTo(0, -20)
  // Ascend while looking sideways: local strafe follows yaw and elevation patches preserve view.
  await face(90)
  await page.keyboard.down('KeyA')
  try { await expect.poll(async () => (await position())[1]!, { intervals: [20], timeout: 10000 }).toBeGreaterThanOrEqual(15) } finally { await page.keyboard.up('KeyA') }
  await expect(page.getByTestId('altitude')).toHaveText('4.1')
  await expect(page.getByTestId('heading')).toContainText('090')
  await face(0)
  await axisTo(0, -15)
  await axisTo(1, 11)
  await axisTo(0, -12)
  async function face(degrees: number) {
    await page.evaluate((target) => {
      const current = Number(document.querySelector('[data-testid="heading"]')!.textContent!.match(/[0-9]+/)![0])
      const delta = ((target - current + 540) % 360) - 180
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: delta * Math.PI / 180 / 0.0024, bubbles: true }))
    }, degrees)
    await expect.poll(async () => {
      const actual = Number((await page.getByTestId('heading').innerText()).match(/[0-9]+/)![0])
      return Math.min(Math.abs(actual - degrees), 360 - Math.abs(actual - degrees))
    }).toBeLessThanOrEqual(1)
  }
  const rooftopPosition = await page.getByTestId('position').innerText()
  for (const direction of [90, 180, 270, 0]) await face(direction)
  await expect(page.getByTestId('position')).toHaveText(rooftopPosition)
  await face(90)
  const beforeSideways = (await position())[0]!
  await page.keyboard.down('KeyW')
  await expect.poll(async () => (await position())[0]!).toBeGreaterThan(beforeSideways + 0.25)
  await page.keyboard.up('KeyW')
  await expect(page.getByTestId('heading')).toContainText('090')
  await expect(page.getByTestId('altitude')).toHaveText('4.1')
  await face(180)
  await page.screenshot({ path: testInfo.outputPath('rooftop-looking-back.png') })
  // Bound vertical look, then restore it, without affecting the 180-degree heading.
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('mousemove', { movementY: 100000 })))
  await expect(page.getByTestId('heading')).toHaveAttribute('data-pitch', '1.4500')
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('mousemove', { movementY: -100000 })))
  await expect(page.getByTestId('heading')).toHaveAttribute('data-pitch', '-1.4500')
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('mousemove', { movementY: 1.45 / 0.0024 })))
  await face(0)
  await page.keyboard.press('Escape')
  await expect(page.locator('.crosshair')).toBeHidden()
  await page.getByRole('button', { name: 'Use gamepad' }).click()
  const stationary = await page.getByTestId('position').innerText()
  await page.evaluate(() => { (navigator.getGamepads()[0]!.axes as number[])[2] = 1 })
  await expect.poll(async () => { const angle = Number((await page.getByTestId('heading').innerText()).match(/[0-9]+/)![0]); return angle > 175 && angle < 205 }, { intervals: [20] }).toBe(true)
  await page.evaluate(() => { (navigator.getGamepads()[0]!.axes as number[])[2] = 0 })
  await expect(page.getByTestId('position')).toHaveText(stationary)
  await expect(page.getByTestId('altitude')).toHaveText('4.1')
  await page.evaluate(() => { (navigator.getGamepads()[0]!.axes as number[])[2] = -1 })
  await expect.poll(async () => Number((await page.getByTestId('heading').innerText()).match(/[0-9]+/)![0]), { intervals: [20] }).toBeLessThan(15)
  await page.evaluate(() => { (navigator.getGamepads()[0]!.axes as number[])[2] = 0; Object.defineProperty(navigator.getGamepads()[0]!.buttons[1], 'pressed', { value: true, configurable: true }) })
  await expect(page.locator('.crosshair')).toBeHidden()
  await page.evaluate(() => { Object.defineProperty(navigator.getGamepads()[0]!.buttons[1], 'pressed', { value: false }) })
  await page.getByRole('button', { name: 'Take control' }).click()
  await expect(page.locator('.crosshair')).toBeVisible()
  await face(0)
  await page.screenshot({ path: testInfo.outputPath('rooftop.png') })
  // Return via the ramp, then enter the cafe's open east doorway from the street.
  await axisTo(0, -17)
  await axisTo(1, 15.1)
  await axisTo(0, -20)
  await axisTo(1, 5.1)
  await expect(page.getByTestId('altitude')).toHaveText('0.0')
  await axisTo(1, 4.5)
  await axisTo(0, -3)
  await axisTo(1, 11)
  await axisTo(0, -12)
  await expect(page.getByTestId('altitude')).toHaveText('0.0')
  await page.screenshot({ path: testInfo.outputPath('cafe-interior.png') })
})
