import { test, expect } from '@playwright/test'
import { browserAccount } from './accounts'

for (const scenario of [
  {
    name: 'retina-campaign',
    mode: 'campaign',
    mobile: false,
    width: 1280,
    height: 720,
    density: 2,
  },
  { name: 'phone-campaign', mode: 'campaign', mobile: true, width: 844, height: 390, density: 3 },
  { name: 'online-daylight', mode: 'online', mobile: false, width: 1280, height: 720, density: 1 },
])
  test(`${scenario.name} renders clear daylight at bounded pixel density`, async ({
    browser,
  }, info) => {
    test.setTimeout(60000)
    const context = await browser.newContext({
      viewport: { width: scenario.width, height: scenario.height },
      deviceScaleFactor: scenario.density,
      isMobile: scenario.mobile,
      hasTouch: scenario.mobile,
    })
    const page = await context.newPage(),
      errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    try {
      if (scenario.mode === 'online') await browserAccount(page, 'visualdaylight')
      await page.goto(`http://127.0.0.1:3001/play?mode=${scenario.mode}`)
      await expect(page.locator('.radar-panel')).toContainText('Connected', { timeout: 30000 })
      const start = page.getByRole('button', {
        name: scenario.mode === 'online' ? 'Enter arena' : 'Start mission',
        exact: true,
      })
      if (scenario.mobile) await start.tap()
      else await start.click()
      await expect(page.locator('main.arena')).toHaveAttribute('data-phase', 'playing')
      const pixels = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => ({
        width: canvas.width / canvas.clientWidth,
        height: canvas.height / canvas.clientHeight,
      }))
      expect(pixels.width).toBeCloseTo(Math.min(scenario.density, 1.5), 1)
      expect(pixels.height).toBeCloseTo(Math.min(scenario.density, 1.5), 1)
      await page.waitForTimeout(1800)
      const frameTime = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            let previous = performance.now()
            const samples: number[] = []
            function sample(now: number) {
              samples.push(now - previous)
              previous = now
              if (samples.length === 120) resolve(samples.sort((a, b) => a - b)[60]!)
              else requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
          }),
      )
      console.log(
        `${scenario.name}: median frame interval ${frameTime.toFixed(1)}ms (browser emulation)`,
      )
      await page.screenshot({ path: info.outputPath(`${scenario.name}.png`) })
      expect(errors).toEqual([])
      if (scenario.mobile) await page.getByRole('button', { name: 'Pause', exact: true }).tap()
      else await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Return to menu', exact: true }).click()
      await expect(page).toHaveURL('http://127.0.0.1:3001/')
    } finally {
      await context.close()
    }
  })
