import { quietCampaign } from './campaign-fixture'
import { expect, test, type Page } from '@playwright/test'
async function pulse(page: Page, index: number) {
  await page.bringToFront()
  await page.evaluate(async (index) => {
    const b = navigator.getGamepads()[0]!.buttons[index]!
    Object.defineProperty(b, 'pressed', { value: true, configurable: true })
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    Object.defineProperty(b, 'pressed', { value: false, configurable: true })
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  }, index)
}
for (const controller of [false, true])
  test(`Campaign crouch and stance work with ${controller ? 'controller' : 'mouse and keyboard'}`, async ({
    page,
  }) => {
    await quietCampaign(page)
    test.setTimeout(60000)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    if (controller)
      await page.addInitScript(() => {
        const pad = {
          id: 'Survival controller',
          index: 0,
          connected: true,
          mapping: 'standard',
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })),
        }
        Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true })
      })
    await page.goto('/play?mode=campaign')
    await expect(page.locator('.radar-panel')).toContainText('Connected', { timeout: 30000 })
    if (controller) await pulse(page, 0)
    else await page.getByRole('button', { name: 'Start mission', exact: true }).click()
    await expect(page.locator('main.arena')).toHaveAttribute('data-phase', 'playing')
    if (controller) await pulse(page, 11)
    else await page.keyboard.press('KeyC')
    await expect(page.locator('main.arena')).toHaveAttribute('data-crouch', '1')
    await expect(page.getByTestId('stance')).toContainText('CROUCHED')
    await expect(page.locator('main.arena')).toHaveAttribute('data-eye-height', /^0\.9/)
    if (controller) {
      await pulse(page, 9)
      await expect(page.getByRole('heading', { name: 'Campaign paused.' })).toBeVisible()
      await pulse(page, 0)
      await expect(page.locator('main.arena')).toHaveAttribute('data-crouch', '1')
      await pulse(page, 11)
    } else {
      await page.keyboard.press('KeyC')
      await expect(page.locator('main.arena')).toHaveAttribute('data-crouch', '0')
      await page.keyboard.down('ControlLeft')
      await expect(page.locator('main.arena')).toHaveAttribute('data-crouch', '1')
      await page.keyboard.up('ControlLeft')
    }
    await expect(page.locator('main.arena')).toHaveAttribute('data-crouch', '0')
    if (controller) await pulse(page, 9)
    else await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Campaign paused.' })).toBeVisible()
    expect(errors).toEqual([])
  })
