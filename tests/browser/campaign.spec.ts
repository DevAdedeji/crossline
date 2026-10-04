import { test, expect, type Page } from '@playwright/test'
const key = 'crossline.campaign.last-signal.v1'
const checkpoint = { version: 1, checkpoint: 'rescue', cleared: Array.from({length:7},(_,i)=>`bot-${i}`), completed: false, elapsedMs: 18000 }
async function seed(page: Page) {
  await page.goto('/')
  await page.evaluate(({key,checkpoint}) => localStorage.setItem(key,JSON.stringify(checkpoint)),{key,checkpoint})
}
async function coordinate(page: Page, axis: 'x'|'z') {
  const id=await page.locator('main.arena').getAttribute('data-player-id')
  return Number(await page.locator(`[data-actor="${id}"]`).getAttribute(`data-${axis}`))
}

test('Campaign briefing, saved checkpoint, rescue interaction and retry work on desktop', async ({page}, info) => {
  test.setTimeout(90000)
  const errors: string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await seed(page)
  await page.getByRole('button',{name:'Campaign',exact:true}).click()
  await expect(page).toHaveURL('/campaign')
  await expect(page.getByRole('heading',{name:'The last signal.'})).toBeVisible()
  await expect(page.getByText('Checkpoint available · Recover Finch')).toBeVisible()
  await page.screenshot({path:info.outputPath('campaign-briefing.png')})
  await page.getByRole('button',{name:/^Continue mission/}).click()
  await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
  await page.getByRole('button',{name:'Start mission',exact:true}).click()
  await expect(page.locator('.mission-hud')).toHaveAttribute('data-stage','rescue')
  await expect(page.getByRole('button',{name:/LEADERBOARD/})).toHaveCount(0)
  await page.keyboard.down('s');await expect.poll(()=>coordinate(page,'z'),{intervals:[30]}).toBeLessThan(23.4);await page.keyboard.up('s')
  await page.keyboard.down('d');await expect.poll(()=>coordinate(page,'x'),{timeout:10000,intervals:[30]}).toBeGreaterThan(31.3);await page.keyboard.up('d')
  await page.keyboard.down('w');await expect(page.locator('.mission-interact')).toBeVisible();await page.keyboard.up('w')
  await page.keyboard.down('e');await expect(page.locator('.mission-hud')).toHaveAttribute('data-stage','extract');await page.keyboard.up('e')
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).checkpoint,key)).toBe('extract')
  await page.screenshot({path:info.outputPath('campaign-escort.png')})
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Abort mission',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Contact lost.'})).toBeVisible()
  await page.getByRole('button',{name:'Retry checkpoint',exact:true}).click()
  await expect(page.locator('.mission-hud')).toHaveAttribute('data-stage','extract')
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Return to menu',exact:true}).click()
  expect(errors).toEqual([])
})

test('Campaign mobile briefing fits portrait and touch rescue works in landscape', async ({browser}, info) => {
  test.setTimeout(90000)
  const context=await browser.newContext({baseURL:'http://127.0.0.1:3001',viewport:{width:390,height:844},isMobile:true,hasTouch:true}), page=await context.newPage()
  const errors: string[]=[];page.on('pageerror',e=>errors.push(e.message))
  try {
    await seed(page);await page.goto('/campaign')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:info.outputPath('campaign-portrait.png')})
    await page.getByRole('button',{name:/^Continue mission/}).tap()
    await expect(page.getByRole('dialog',{name:'Rotate phone'})).toBeVisible()
    await page.setViewportSize({width:844,height:390})
    await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
    await page.getByRole('button',{name:'Start mission',exact:true}).tap()
    await expect(page.locator('.mission-hud')).toHaveAttribute('data-stage','rescue')
    const cdp=await context.newCDPSession(page)
    const stick=(await page.getByTestId('touch-move').boundingBox())!
    async function move(x:number,y:number) {
      const center={id:1,x:stick.x+stick.width/2,y:stick.y+stick.height/2}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[center]})
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...center,x:center.x+x,y:center.y+y}]})
    }
    const stop=()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    await move(0,45);await expect.poll(()=>coordinate(page,'z'),{intervals:[30]}).toBeLessThan(23.4);await stop()
    await move(45,0);await expect.poll(()=>coordinate(page,'x'),{timeout:12000,intervals:[30]}).toBeGreaterThan(31.3);await stop()
    await move(0,-45);await expect(page.locator('.mission-interact')).toBeVisible();await stop()
    const button=(await page.locator('.mission-interact').boundingBox())!
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:2,x:button.x+button.width/2,y:button.y+button.height/2}]})
    await expect(page.locator('.mission-hud')).toHaveAttribute('data-stage','extract');await stop()
    const hud=(await page.locator('.mission-hud').boundingBox())!
    expect(hud.x).toBeGreaterThan(90);expect(hud.x+hud.width).toBeLessThan(844)
    await page.screenshot({path:info.outputPath('campaign-mobile.png')})
    await page.getByRole('button',{name:'Pause',exact:true}).tap()
    await page.getByRole('button',{name:'Return to menu',exact:true}).tap()
    expect(errors).toEqual([])
  } finally { await context.close() }
})
