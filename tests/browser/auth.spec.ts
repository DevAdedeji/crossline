import { test, expect } from '@playwright/test'
import { createTestAccount, TEST_PASSWORD } from '../../scripts/test-account'
test('compact signup immediately launches Online, persists login and logs out without exposing email', async ({
  page,
}, info) => {
  test.setTimeout(60000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Online Free-for-All', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Online account' })
  await expect(dialog).toBeVisible()
  await page.getByRole('button', { name: 'New here? Create an account' }).click()
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('AuthPlayer')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('authplayer@example.test')
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'CREATE ACCOUNT & PLAY', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Check your email.' })).toHaveCount(0)
  await expect(page.locator('main.arena')).toHaveAttribute('data-phase', 'playing', {
    timeout: 30000,
  })
  const id = await page.locator('main.arena').getAttribute('data-player-id')
  await expect(page.locator(`[data-actor="${id}"] title`)).toHaveText('authplayer')
  expect(await page.locator('body').innerText()).not.toContain('authplayer@example.test')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Return to menu', exact: true }).click()
  await page.getByRole('button', { name: 'authplayer · LOG OUT' }).click()
  await page.getByRole('button', { name: 'Online Free-for-All', exact: true }).click()
  await expect(dialog).toBeVisible()
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('authplayer@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Incorrect-Test-Password')
  await page.getByRole('button', { name: 'LOG IN & PLAY', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Unable to continue')
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'LOG IN & PLAY', exact: true }).click()
  await expect(page.locator('main.arena')).toHaveAttribute('data-phase', 'playing', {
    timeout: 30000,
  })
  await page.screenshot({ path: info.outputPath('account-online.png') })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Return to menu', exact: true }).click()
  await expect(page).toHaveURL('/')
  await page.reload()
  await expect(page.getByRole('button', { name: 'authplayer · LOG OUT' })).toBeVisible()
  const cookies = await page.context().cookies()
  expect(cookies.find((c) => c.name.endsWith('session_token'))?.httpOnly).toBe(true)
  expect(await page.evaluate(() => document.cookie)).not.toContain('session_token')
  expect(errors).toEqual([])
})
test('landscape phone account form scrolls, accepts signup and launches with touch controls', async ({
  browser,
}, info) => {
  const context = await browser.newContext({
      viewport: { width: 667, height: 375 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    }),
    page = await context.newPage()
  try {
    await page.goto('http://127.0.0.1:3001/play?mode=online')
    await page.getByRole('button', { name: 'New here? Create an account' }).tap()
    await page.getByRole('textbox', { name: 'Username', exact: true }).fill('phoneauth')
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('phoneauth@example.test')
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
    await page.screenshot({ path: info.outputPath('phone-signup.png') })
    await page.getByRole('button', { name: 'CREATE ACCOUNT & PLAY', exact: true }).tap()
    await expect(page.locator('main.arena')).toHaveAttribute('data-phase', 'playing', {
      timeout: 30000,
    })
    await expect(page.getByRole('button', { name: 'Fire', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Pause', exact: true }).tap()
    await page.getByRole('button', { name: 'Return to menu', exact: true }).tap()
    await expect(page).toHaveURL('http://127.0.0.1:3001/')
  } finally {
    await context.close()
  }
})

test('controller navigates account fields, logs in and requires releasing A before firing', async ({
  page,
}) => {
  await createTestAccount('http://127.0.0.1:3001', 'padauth')
  await page.addInitScript(() => {
    const pad = {
      id: 'Account test controller',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })),
    }
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true })
  })
  await page.goto('/play?mode=online')
  const email = page.getByRole('textbox', { name: 'Email', exact: true })
  await email.fill('padauth@example.test')
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
  async function button(index: number, pressed: boolean) {
    await page.evaluate(
      ({ index, pressed }) =>
        Object.defineProperty(navigator.getGamepads()[0]!.buttons[index], 'pressed', {
          value: pressed,
          configurable: true,
        }),
      { index, pressed },
    )
  }
  await button(13, true)
  await page.waitForTimeout(120)
  await button(13, false)
  await expect(page.getByRole('button', { name: 'LOG IN & PLAY', exact: true })).toBeFocused()
  await button(0, true)
  await expect(page.locator('main.arena')).toHaveAttribute('data-phase', 'playing', {
    timeout: 30000,
  })
  await page.waitForTimeout(400)
  await expect(page.getByTestId('ammo')).toContainText('24 /')
  await button(0, false)
  await page.waitForTimeout(150)
  await button(0, true)
  await expect(page.getByTestId('ammo')).not.toContainText('24 /')
  await button(0, false)
  await button(9, true)
  await page.waitForTimeout(120)
  await button(9, false)
  await page.getByRole('button', { name: 'Return to menu', exact: true }).click()
  await expect(page).toHaveURL('/')
})
