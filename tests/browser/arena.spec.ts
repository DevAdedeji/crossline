import { expect, test, type Page } from '@playwright/test'
async function connected(page: Page) {
  await expect(page.locator('.radar-panel')).toContainText('Connected', { timeout: 20000 })
  await expect(page.locator('[data-actor]')).toHaveCount(6)
}
async function start(page: Page) {
  await page.getByRole('button', { name: 'Start training', exact: true }).click()
  await expect(page.locator('.crosshair')).toBeVisible()
  await expect(page.locator('main.arena')).toHaveAttribute('data-phase', 'playing')
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

test('real mouse target practice, reload, pause, results, replay and exit', async ({
  page,
}, info) => {
  test.setTimeout(65000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.keyboard.press('ArrowLeft')
  await expect(
    page.getByRole('button', { name: 'Online Free-for-All — in development' }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toContainText('in development')
  await page.getByRole('button', { name: 'Training', exact: true }).click()
  await page.getByRole('link', { name: 'Enter training' }).click()
  await connected(page)
  await start(page)
  const initial = await page.getByTestId('position').innerText()
  await page.keyboard.down('KeyW')
  await expect(page.getByTestId('position')).not.toHaveText(initial)
  await page.keyboard.up('KeyW')
  // Aim at visible radar targets using only the same relative mouse input as a player.
  await page.mouse.down({ button: 'right' })
  await page.mouse.down()
  const deadline = Date.now() + 14000
  while (Date.now() < deadline && Number(await page.getByTestId('score').innerText()) < 100) {
    const target = await page.locator('[data-actor]').evaluateAll((nodes) => {
      const data = nodes.map((n) => ({
          id: n.getAttribute('data-actor')!,
          x: Number(n.getAttribute('data-x')),
          y: Number(n.getAttribute('data-y')),
          z: Number(n.getAttribute('data-z')),
          health: Number(n.getAttribute('data-health')),
        })),
        me = data.find((a) => !a.id.startsWith('bot-'))!
      const bots = data
        .filter((a) => a.id.startsWith('bot-') && a.health > 0)
        .sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))
      const b = bots[0]!
      return {
        yaw: (Math.atan2(b.x - me.x, b.z - me.z) * 180) / Math.PI,
        pitch: -Math.atan2(b.y + 1.5 - me.y - 1.6, Math.hypot(b.x - me.x, b.z - me.z)),
      }
    })
    await face(page, (target.yaw + 360) % 360, target.pitch)
    if (Number((await page.getByTestId('ammo').innerText()).split('/')[0]) === 0)
      await page.keyboard.press('KeyR')
    await page.waitForTimeout(90)
  }
  await page.mouse.up()
  await page.mouse.up({ button: 'right' })
  await expect
    .poll(async () => Number(await page.getByTestId('score').innerText()))
    .toBeGreaterThanOrEqual(100)
  await page.keyboard.press('KeyR')
  await expect(page.getByTestId('ammo')).toContainText('24 /')
  await page.screenshot({ path: info.outputPath('live-combat.png') })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Training paused.' })).toBeVisible()
  const frozen = (await page.getByTestId('timer').textContent())!
  await page.waitForTimeout(1100)
  await expect(page.getByTestId('timer')).toHaveText(frozen)
  await page.getByRole('button', { name: 'Resume training' }).click()
  await expect(page.locator('.crosshair')).toBeVisible()
  // Targets never attack: an exposed player stays unharmed while patrols move.
  await page.waitForTimeout(2500)
  await expect(page.getByTestId('health')).toContainText('100')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Finish session' }).click()
  await expect(page.getByTestId('results')).toBeVisible()
  await page.screenshot({ path: info.outputPath('results.png') })
  await page.getByRole('button', { name: 'Run it again' }).click()
  await expect(page.getByRole('heading', { name: 'Learn the block.' })).toBeVisible()
  await expect(page.getByTestId('score')).toHaveText('0')
  await expect(page.getByTestId('timer')).toContainText('3:00')
  await page.getByRole('button', { name: 'Return to menu' }).click()
  await expect(page).toHaveURL('/')
  expect(errors).toEqual([])
})

test('standard controller can play, aim/fire/reload, turn 360, pause/menu and disconnect', async ({
  page,
}, info) => {
  await padSetup(page)
  await page.goto('/')
  await expect(page.getByTestId('menu-controller')).toContainText('GAMEPAD CONNECTED')
  await pulse(page, 0)
  await expect(page).toHaveURL('/play')
  await connected(page)
  await pulse(page, 0)
  await expect(page.locator('.crosshair')).toBeVisible()
  await page.evaluate(() => {
    ;(navigator.getGamepads()[0]!.axes as number[])[1] = -1
    ;(navigator.getGamepads()[0]!.axes as number[])[2] = 1
  })
  await expect(page.getByTestId('position')).not.toHaveText('0.0 / -21.0')
  await expect
    .poll(async () => Number((await page.getByTestId('heading').innerText()).match(/[0-9]+/)![0]))
    .toBeGreaterThan(180)
  await page.evaluate(() => {
    ;(navigator.getGamepads()[0]!.axes as number[]).fill(0)
  })
  await button(page, 6, true)
  await button(page, 7, true)
  await expect(page.getByTestId('ammo')).not.toContainText('24 /')
  await button(page, 7, false)
  await button(page, 6, false)
  await pulse(page, 2)
  await expect(page.getByTestId('ammo')).toContainText('24 /')
  await pulse(page, 9)
  await expect(page.getByRole('heading', { name: 'Training paused.' })).toBeVisible()
  await pulse(page, 13)
  await pulse(page, 13)
  await pulse(page, 0)
  await expect(page.getByTestId('results')).toBeVisible()
  await pulse(page, 0)
  await expect(page.getByRole('heading', { name: 'Learn the block.' })).toBeVisible()
  await pulse(page, 0)
  await expect(page.locator('.crosshair')).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(navigator.getGamepads()[0], 'connected', {
      value: false,
      configurable: true,
    })
    window.dispatchEvent(new Event('gamepaddisconnected'))
  })
  await expect(page.getByTestId('gamepad-status')).toContainText('disconnected')
  await expect(page.getByRole('heading', { name: 'Training paused.' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('controller-paused.png') })
  await page.evaluate(() => {
    Object.defineProperty(navigator.getGamepads()[0], 'connected', { value: true })
    Object.defineProperty(navigator.getGamepads()[0], 'mapping', { value: '' })
  })
  await expect(page.getByTestId('gamepad-status')).toContainText('generic layout')
  await expect(page.getByRole('button', { name: 'Resume training' })).toBeEnabled()
})

test('urban rooftop route preserves stationary/moving 360-degree mouse look', async ({
  page,
}, info) => {
  test.setTimeout(65000)
  await page.goto('/play')
  await connected(page)
  await start(page)
  for (const angle of [90, 180, 270, 0]) {
    await face(page, angle)
    await expect
      .poll(async () => Number((await page.getByTestId('heading').innerText()).match(/[0-9]+/)![0]))
      .toBeCloseTo(angle, 0)
  }
  async function position() {
    return (await page.getByTestId('position').innerText()).split(' / ').map(Number)
  }
  async function axisTo(axis: 0 | 1, target: number) {
    const positive = target > (await position())[axis]!,
      key = axis === 0 ? (positive ? 'KeyD' : 'KeyA') : positive ? 'KeyW' : 'KeyS'
    await page.keyboard.down(key)
    try {
      await expect
        .poll(
          async () =>
            positive
              ? (await position())[axis]! >= target - 0.1
              : (await position())[axis]! <= target + 0.1,
          { intervals: [20], timeout: 10000 },
        )
        .toBe(true)
    } finally {
      await page.keyboard.up(key)
    }
    await page.waitForTimeout(120)
  }
  await axisTo(0, -21)
  await axisTo(1, -20)
  await axisTo(0, -24)
  await axisTo(1, 4)
  await axisTo(0, -20)
  await face(page, 90)
  await page.keyboard.down('KeyA')
  try {
    await expect
      .poll(async () => (await position())[1]!, { intervals: [20], timeout: 10000 })
      .toBeGreaterThanOrEqual(15)
  } finally {
    await page.keyboard.up('KeyA')
  }
  await expect(page.getByTestId('altitude')).toHaveText('4.1')
  await expect(page.getByTestId('heading')).toContainText('090')
  await face(page, 0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Training paused.' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('rooftop.png') })
})

test('confirmed body hits, misses and animated elimination with non-clipping recorded audio', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const original = AudioNode.prototype.connect
    const meters: AnalyserNode[] = []
    AudioNode.prototype.connect = function (
      this: AudioNode,
      ...args: [AudioNode | AudioParam, number?, number?]
    ) {
      const result = Reflect.apply(original, this, args)
      if (args[0] === this.context.destination) {
        const meter = this.context.createAnalyser()
        meter.fftSize = 1024
        Reflect.apply(original, this, [meter])
        meters.push(meter)
      }
      return result
    } as AudioNode['connect']
    ;(window as unknown as { audioMeters: AnalyserNode[] }).audioMeters = meters
  })
  await page.goto('/play')
  await connected(page)
  await start(page)
  await page.waitForTimeout(1950)
  await face(page, 360 - (Math.atan2(1, 16) * 180) / Math.PI, Math.atan2(0.55, Math.hypot(1, 16)))
  await expect(page.locator('.crosshair')).toHaveAttribute('data-target', 'bot-0')
  await expect(page.locator('.crosshair')).toHaveCSS('color', 'rgb(255, 83, 83)')
  await page.mouse.down()
  await page.waitForTimeout(90)
  await page.mouse.up()
  // Wait for the input-stop packet and its final state patch before comparing a later miss.
  await page.waitForTimeout(250)
  const hitHealth = Number(await page.locator('[data-actor="bot-0"]').getAttribute('data-health'))
  expect(hitHealth).toBeGreaterThan(0)
  expect(hitHealth).toBeLessThan(100)
  await page.screenshot({ path: info.outputPath('confirmed-hit-flinch.png') })
  await face(page, 180)
  await expect(page.locator('.crosshair')).toHaveAttribute('data-target', '')
  await page.mouse.down()
  await page.waitForTimeout(90)
  await page.mouse.up()
  await page.waitForTimeout(150)
  await expect(page.locator('[data-actor="bot-0"]')).toHaveAttribute(
    'data-health',
    String(hitHealth),
  )
  await face(page, 360 - (Math.atan2(1, 16) * 180) / Math.PI, Math.atan2(0.05, Math.hypot(1, 16)))
  await page.mouse.down()
  const audio = await page.evaluate(async () => {
    let peak = 0,
      activeBands = 0
    for (let i = 0; i < 18; i++) {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      for (const meter of (window as unknown as { audioMeters: AnalyserNode[] }).audioMeters) {
        const samples = new Float32Array(meter.fftSize)
        meter.getFloatTimeDomainData(samples)
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
        const bands = new Uint8Array(meter.frequencyBinCount)
        meter.getByteFrequencyData(bands)
        activeBands = Math.max(activeBands, bands.filter((v) => v > 30).length)
      }
    }
    return { peak, activeBands }
  })
  // Compensate actual weapon recoil with mouse input while holding the trigger.
  for (
    let i = 0;
    i < 25 && Number(await page.locator('[data-actor="bot-0"]').getAttribute('data-health')) > 0;
    i++
  ) {
    await face(page, 360 - (Math.atan2(1, 16) * 180) / Math.PI, Math.atan2(0.05, Math.hypot(1, 16)))
    await page.waitForTimeout(80)
  }
  await page.mouse.up()
  await expect(page.locator('[data-actor="bot-0"]')).toHaveAttribute('data-health', '0')
  expect(audio.peak).toBeGreaterThan(0.001)
  expect(audio.peak).toBeLessThan(0.99)
  expect(audio.activeBands).toBeGreaterThan(10)
  await expect(page.locator('[data-actor="bot-0"]')).toHaveAttribute('data-health', '0')
  await page.waitForTimeout(400)
  await expect(page.locator('.crosshair')).toHaveAttribute('data-target', '')
  await page.screenshot({ path: info.outputPath('animated-elimination.png') })
  await expect(page.locator('[data-actor="bot-0"]')).toHaveAttribute('data-health', '100', {
    timeout: 5000,
  })
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
  await page.goto('/play')
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
  await expect(page.getByRole('heading', { name: 'Training paused.' })).toBeVisible()
  expect(await reloads()).toHaveLength(1)
  await expect(page.getByText(/^RELOADING [0-9.]+s$/)).toBeVisible()
  const frozen = await page.getByTestId('ammo').textContent()
  await page.waitForTimeout(400)
  await expect(page.getByTestId('ammo')).toHaveText(frozen!)
  await page.getByRole('button', { name: 'Resume training', exact: true }).click()
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
    await page.screenshot({ path: info.outputPath(`weapon-aim-${viewport.width}.png`) })
    await page.mouse.up({ button: 'right' })
  }
  expect(errors).toEqual([])
})

test('analog right trigger fires after mouse start without its pressed flag', async ({ page }) => {
  await padSetup(page)
  await page.goto('/play'); await connected(page); await start(page)
  await page.evaluate(() => { Object.defineProperty(navigator.getGamepads()[0]!.buttons[7], 'value', { value: .8, configurable: true }) })
  await expect(page.getByTestId('active-controller')).toContainText('CONTROLLER ACTIVE')
  await expect.poll(async () => Number((await page.getByTestId('ammo').innerText()).split('/')[0])).toBeLessThan(22)
  await page.evaluate(() => { Object.defineProperty(navigator.getGamepads()[0]!.buttons[7], 'value', { value: 0, configurable: true }) })
  await page.waitForTimeout(200)
  const ammo = await page.getByTestId('ammo').textContent()
  await page.waitForTimeout(450); await expect(page.getByTestId('ammo')).toHaveText(ammo!)
  await pulse(page, 9); await expect(page.getByRole('heading', { name: 'Training paused.' })).toBeVisible()
  await page.evaluate(() => { Object.defineProperty(navigator.getGamepads()[0], 'connected', { value: false, configurable: true }) })
  await expect(page.getByTestId('gamepad-status')).toContainText('disconnected')
  await page.evaluate(() => { Object.defineProperty(navigator.getGamepads()[0], 'connected', { value: true }); Object.defineProperty(navigator.getGamepads()[0], 'mapping', { value: '' }) })
  await expect(page.getByTestId('gamepad-status')).toContainText('generic layout')
  await pulse(page, 0); await page.evaluate(() => { Object.defineProperty(navigator.getGamepads()[0]!.buttons[7], 'value', { value: .8, configurable: true }) })
  await expect.poll(async () => Number((await page.getByTestId('ammo').innerText()).split('/')[0])).toBeLessThan(Number(ammo!.split('/')[0]))
})

test('select face button also fires, with release gating across start and resume', async ({ page }) => {
  await padSetup(page); await page.goto('/play'); await connected(page)
  await button(page, 0, true)
  await expect(page.locator('main.arena')).toHaveAttribute('data-phase', 'playing')
  await page.waitForTimeout(600); await expect(page.getByTestId('ammo')).toContainText('24 /')
  await button(page, 0, false); await page.waitForTimeout(100)
  await button(page, 0, true)
  await expect.poll(async () => Number((await page.getByTestId('ammo').innerText()).split('/')[0])).toBeLessThan(22)
  await button(page, 0, false); await pulse(page, 9)
  await expect(page.getByRole('heading', { name: 'Training paused.' })).toBeVisible()
  const pausedAmmo = await page.getByTestId('ammo').textContent()
  await button(page, 0, true)
  await expect(page.locator('main.arena')).toHaveAttribute('data-phase', 'playing')
  await page.waitForTimeout(500); await expect(page.getByTestId('ammo')).toHaveText(pausedAmmo!)
  await button(page, 0, false); await page.waitForTimeout(100); await button(page, 7, true)
  await expect.poll(async () => Number((await page.getByTestId('ammo').innerText()).split('/')[0])).toBeLessThan(Number(pausedAmmo!.split('/')[0]))
  await button(page, 7, false)
})


test('Solo is a separate combat match with damage, pause, standings and replay', async ({ page }, info) => {
  test.setTimeout(60000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await padSetup(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Solo vs Bots', exact: true }).click()
  await page.getByRole('link', { name: 'Enter solo vs bots' }).click()
  await connected(page)
  await expect(page.locator('main.arena')).toHaveAttribute('data-mode', 'solo')
  await pulse(page, 0)
  await expect(page.locator('main.arena')).toHaveAttribute('data-phase', 'playing')
  await expect.poll(async () => page.locator('[data-actor]').evaluateAll(nodes => nodes.some(node => Number(node.getAttribute('data-health')) < 100)), { timeout: 30000 }).toBe(true)
  await button(page, 0, true)
  await expect(page.getByTestId('ammo')).not.toContainText('24 /')
  await button(page, 0, false)
  await pulse(page, 9)
  await expect(page.getByRole('heading', { name: 'Solo vs Bots paused.' })).toBeVisible()
  const frozen = (await page.getByTestId('timer').textContent())!
  await page.waitForTimeout(500)
  await expect(page.getByTestId('timer')).toHaveText(frozen)
  await page.getByRole('button', { name: 'Finish session', exact: true }).click()
  await expect(page.getByTestId('results')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Match standings' }).getByRole('listitem')).toHaveCount(6)
  await page.screenshot({ path: info.outputPath('solo-results.png') })
  await pulse(page, 0)
  await expect(page.getByRole('heading', { name: 'Every angle is live.' })).toBeVisible()
  await expect(page.getByTestId('score')).toHaveText('0')
  await pulse(page, 1)
  await expect(page).toHaveURL('/')
  expect(errors).toEqual([])
})
