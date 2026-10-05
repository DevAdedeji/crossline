import { quietCampaign } from './campaign-fixture'
import { expect, test, type Page } from '@playwright/test'
async function connected(page: Page, count = 17) {
  await expect(page.locator('.radar-panel')).toContainText('Connected', { timeout: 20000 })
  await expect(page.locator('[data-actor]')).toHaveCount(count)
}
async function start(page: Page) {
  await page.getByRole('button', { name: 'Start mission', exact: true }).click()
  await expect(page.locator('.crosshair')).toBeVisible()
  await expect(page.locator('main.arena')).toHaveAttribute('data-phase', 'playing')
  await expect(page.getByText('SPAWN PROTECTION',{exact:true})).toBeHidden({timeout:6000})
}
async function face(page: Page, degrees: number, pitch = 0) {
  await page.evaluate(
    ({ target, p }) => {
      const el = document.querySelector('[data-testid="heading"]')!,
        current = Number(el.textContent!.match(/[0-9]+/)![0]),
        currentPitch = Number(el.getAttribute('data-pitch')),
        delta = ((target - current + 540) % 360) - 180
      document.dispatchEvent(
        new MouseEvent('mousemove', {
          movementX: (delta * Math.PI) / 180 / 0.0024,
          movementY: (p - currentPitch) / 0.0024,
          bubbles: true,
        }),
      )
    },
    { target: degrees, p: pitch },
  )
}
async function padSetup(page: Page) {
  await page.addInitScript(() => {
    const pad = {
      id: 'Simulated standard controller',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })),
    }
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true })
  })
}
async function button(page: Page, index: number, pressed: boolean) {
  await page.evaluate(
    ({ index, pressed }) =>
      Object.defineProperty(navigator.getGamepads()[0]!.buttons[index], 'pressed', {
        value: pressed,
        configurable: true,
      }),
    { index, pressed },
  )
}
async function pulse(page: Page, index: number) {
  await page.bringToFront()
  await page.evaluate(async (i) => {
    const b = navigator.getGamepads()[0]!.buttons[i]!
    Object.defineProperty(b, 'pressed', { value: true, configurable: true })
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    Object.defineProperty(b, 'pressed', { value: false })
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  }, index)
}

test.beforeEach(async({page})=>quietCampaign(page))

test('mouse and controller fire stay at hip level while former aim controls are held', async ({page}) => {
  await padSetup(page)
  await page.addInitScript(() => {
    const inputs: {fire:boolean;aim:boolean}[] = []
    ;(window as unknown as {combatInputs:typeof inputs}).combatInputs = inputs
    const post = Worker.prototype.postMessage
    Worker.prototype.postMessage = function(message, options?: StructuredSerializeOptions | Transferable[]) {
      if (message.type === 'input') inputs.push(message.value)
      return post.call(this, message, Array.isArray(options) ? {transfer:options} : options)
    }
  })
  const inputs = () => page.evaluate(() => (window as unknown as {combatInputs:{fire:boolean;aim:boolean}[]}).combatInputs)
  await page.goto('/play?mode=campaign'); await connected(page); await start(page)
  await page.mouse.down({button:'right'}); await page.mouse.down()
  await expect(page.getByTestId('ammo')).not.toContainText('24 /')
  await page.mouse.up(); await page.mouse.up({button:'right'})
  expect((await inputs()).some(input => input.fire)).toBe(true)
  expect((await inputs()).every(input => !input.aim)).toBe(true)
  await page.evaluate(() => { (window as unknown as {combatInputs:unknown[]}).combatInputs.length = 0 })
  await button(page,6,true); await button(page,7,true)
  await expect.poll(async () => (await inputs()).some(input => input.fire)).toBe(true)
  await button(page,7,false); await button(page,6,false)
  expect((await inputs()).every(input => !input.aim)).toBe(true)
})

test('recorded reload follows pause/resume and weapon framing survives viewport changes', async ({
  page,
}, info) => {
  test.setTimeout(65000)
  await page.addInitScript(() => {
    const starts: { duration: number; offset: number; rate: number }[] = []
    ;(window as unknown as { recordedStarts: typeof starts }).recordedStarts = starts
    const original = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (
      when?: number,
      offset?: number,
      duration?: number,
    ) {
      starts.push({
        duration: this.buffer?.duration ?? 0,
        offset: offset ?? 0,
        rate: this.playbackRate.value,
      })
      const result = Reflect.apply(original, this, [when ?? 0, offset ?? 0, duration])
      if (this.buffer?.duration === 1.6 && starts.filter((s) => s.duration === 1.6).length === 1) {
        // Pause relative to playback start, before slow software-rendered polling can finish reload.
        setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })), 250)
      }
      return result
    }
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/play?mode=campaign')
  await connected(page)
  await start(page)
  const reloads = () =>
    page.evaluate(() =>
      (
        window as unknown as {
          recordedStarts: { duration: number; offset: number; rate: number }[]
        }
      ).recordedStarts.filter((s) => s.duration > 1.4 && s.duration < 2),
    )
  await page.keyboard.press('KeyR')
  expect(await reloads()).toHaveLength(0)
  await face(page, 180)
  await page.mouse.down()
  await page.waitForTimeout(180)
  await page.mouse.up()
  await expect(page.getByTestId('ammo')).not.toContainText('24 /')
  await page.keyboard.press('KeyR')
  await expect(page.getByRole('heading', { name: 'Campaign paused.' })).toBeVisible()
  expect(await reloads()).toHaveLength(1)
  await expect(page.getByText(/^RELOADING [0-9.]+s$/)).toBeVisible()
  const frozen = await page.getByTestId('ammo').textContent()
  await page.waitForTimeout(400)
  await expect(page.getByTestId('ammo')).toHaveText(frozen!)
  await page.getByRole('button', { name: 'Resume mission', exact: true }).click()
  await expect.poll(async () => (await reloads()).length).toBe(2)
  expect((await reloads())[1]!.offset).toBeGreaterThan(0.1)
  await expect(page.getByTestId('ammo')).toContainText('24 /')
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1920, height: 820 },
  ]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(250)
    await page.screenshot({ path: info.outputPath(`weapon-hip-${viewport.width}.png`) })
    await page.mouse.down({ button: 'right' })
    await page.waitForTimeout(350)
    await page.screenshot({ path: info.outputPath(`weapon-right-click-${viewport.width}.png`) })
    await page.mouse.up({ button: 'right' })
  }
  expect(errors).toEqual([])
})

test('analog right trigger fires after mouse start without its pressed flag', async ({ page }) => {
  await padSetup(page)
  await page.goto('/play?mode=campaign'); await connected(page); await start(page)
  await page.evaluate(() => { Object.defineProperty(navigator.getGamepads()[0]!.buttons[7], 'value', { value: .8, configurable: true }) })
  await expect(page.getByTestId('active-controller')).toContainText('CONTROLLER ACTIVE')
  await expect.poll(async () => Number((await page.getByTestId('ammo').innerText()).split('/')[0])).toBeLessThan(22)
  await page.evaluate(() => { Object.defineProperty(navigator.getGamepads()[0]!.buttons[7], 'value', { value: 0, configurable: true }) })
  await page.waitForTimeout(200)
  const ammo = await page.getByTestId('ammo').textContent()
  await page.waitForTimeout(450); await expect(page.getByTestId('ammo')).toHaveText(ammo!)
  await pulse(page, 9); await expect(page.getByRole('heading', { name: 'Campaign paused.' })).toBeVisible()
  await page.evaluate(() => { Object.defineProperty(navigator.getGamepads()[0], 'connected', { value: false, configurable: true }) })
  await expect(page.getByTestId('gamepad-status')).toContainText('disconnected')
  await page.evaluate(() => { Object.defineProperty(navigator.getGamepads()[0], 'connected', { value: true }); Object.defineProperty(navigator.getGamepads()[0], 'mapping', { value: '' }) })
  await expect(page.getByTestId('gamepad-status')).toContainText('generic layout')
  await pulse(page, 0); await page.evaluate(() => { Object.defineProperty(navigator.getGamepads()[0]!.buttons[7], 'value', { value: .8, configurable: true }) })
  await expect.poll(async () => Number((await page.getByTestId('ammo').innerText()).split('/')[0])).toBeLessThan(Number(ammo!.split('/')[0]))
})

test('select face button also fires, with release gating across start and resume', async ({ page }) => {
  await padSetup(page); await page.goto('/play?mode=campaign'); await connected(page)
  await button(page, 0, true)
  await expect(page.locator('main.arena')).toHaveAttribute('data-phase', 'playing')
  await page.waitForTimeout(600); await expect(page.getByTestId('ammo')).toContainText('24 /')
  await expect(page.getByText('SPAWN PROTECTION',{exact:true})).toBeHidden({timeout:6000})
  await button(page, 0, false); await page.waitForTimeout(100)
  await button(page, 0, true)
  await expect.poll(async () => Number((await page.getByTestId('ammo').innerText()).split('/')[0])).toBeLessThan(22)
  await button(page, 0, false); await pulse(page, 9)
  await expect(page.getByRole('heading', { name: 'Campaign paused.' })).toBeVisible()
  const pausedAmmo = await page.getByTestId('ammo').textContent()
  await button(page, 0, true)
  await expect(page.locator('main.arena')).toHaveAttribute('data-phase', 'playing')
  await page.waitForTimeout(500); await expect(page.getByTestId('ammo')).toHaveText(pausedAmmo!)
  await button(page, 0, false); await page.waitForTimeout(100); await button(page, 7, true)
  await expect.poll(async () => Number((await page.getByTestId('ammo').innerText()).split('/')[0])).toBeLessThan(Number(pausedAmmo!.split('/')[0]))
  await button(page, 7, false)
})




test('campaign mouse movement, full rotation, crouch and pause preserve the live session',async({page})=>{
  await page.goto('/play?mode=campaign');await connected(page);await start(page)
  const initial=await page.getByTestId('position').innerText()
  await page.keyboard.down('KeyW');await expect(page.getByTestId('position')).not.toHaveText(initial);await page.keyboard.up('KeyW')
  for(const degrees of [90,180,270,0]){
    await face(page,degrees)
    await expect.poll(async()=>Number((await page.getByTestId('heading').innerText()).match(/[0-9]+/)![0])).toBeCloseTo(degrees,0)
  }
  await page.keyboard.press('KeyC');await expect(page.locator('main.arena')).toHaveAttribute('data-crouch','1')
  await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'Campaign paused.'})).toBeVisible()
  const frozen=await page.getByTestId('timer').textContent();await page.waitForTimeout(500);await expect(page.getByTestId('timer')).toHaveText(frozen!)
  await page.getByRole('button',{name:'Resume mission'}).click();await expect(page.locator('main.arena')).toHaveAttribute('data-crouch','1')
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Return to menu'}).click();await expect(page).toHaveURL('/')
})
