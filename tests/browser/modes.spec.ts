import { test, expect } from '@playwright/test'

test('only Campaign and Online are offered, including keyboard navigation and old bookmarks', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('main.lobby')).toHaveAttribute('data-ready', 'true')
  const choices = page.getByRole('navigation', { name: 'Game modes' }).getByRole('button')
  await expect(choices).toHaveCount(2)
  await expect(choices.nth(0)).toHaveAttribute('aria-label', 'Campaign')
  await expect(choices.nth(1)).toHaveAttribute('aria-label', 'Online Free-for-All')
  await page.keyboard.press('ArrowRight')
  await expect(choices.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(choices.nth(0)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/campaign')
  for (const old of ['/play', '/play?mode=solo', '/play?mode=training', '/play?mode=invalid']) {
    await page.goto(old)
    await expect(page).toHaveURL('/campaign')
    await expect(page.getByRole('heading', { name: 'Choose your mission.' })).toBeVisible()
  }
})

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 667, height: 375 },
])
  test(`larger mission briefing is readable and scrollable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport)
    await page.goto('/campaign?mission=open-horizon')
    const dialog = page.getByRole('dialog'),
      copy = page.locator('.brief-copy')
    await expect(dialog).toBeVisible()
    await expect(copy).toHaveCSS('font-size', '18px')
    await expect(page.locator('.objective')).toHaveCSS('font-size', '20px')
    await expect(page.getByRole('heading', { name: 'Open horizon' })).toBeInViewport()
    expect(await dialog.evaluate((el) => el.scrollTop)).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const bounds = (await dialog.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width)
    expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height)
    await page.screenshot({ path: info.outputPath(`briefing-${viewport.width}.png`) })
    const launch = page.getByRole('button', { name: 'Got it, let’s go' })
    await launch.scrollIntoViewIfNeeded()
    await expect(launch).toBeInViewport()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
