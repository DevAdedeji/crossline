import { test, expect } from '@playwright/test'

test('Campaign player throws with G and pause cannot consume a grenade',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/play?mode=campaign')
  await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
  await page.getByRole('button',{name:'Start mission',exact:true}).click()
  await expect(page.getByTestId('grenade-count')).toContainText('2 GRENADES')
  await page.keyboard.press('g');await expect(page.getByTestId('grenade-count')).toContainText('1 GRENADES')
  await page.keyboard.press('Escape');await page.keyboard.press('g')
  await page.getByRole('button',{name:'Resume mission',exact:true}).click()
  await expect(page.getByTestId('grenade-count')).toContainText('1 GRENADES')
  await page.waitForTimeout(1100);await page.keyboard.press('g')
  await expect(page.getByTestId('grenade-count')).toContainText('0 GRENADES')
  await page.waitForTimeout(3000);expect(errors).toEqual([])
})

test('Mobile grenade control stays separate from reload and uses the same inventory',async({browser},info)=>{
  const context=await browser.newContext({baseURL:'http://127.0.0.1:3001',viewport:{width:844,height:390},hasTouch:true,isMobile:true}),page=await context.newPage()
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  try{
    await page.goto('/play?mode=campaign')
    await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
    await page.getByRole('button',{name:'Start mission',exact:true}).tap()
    const grenade=page.getByRole('button',{name:'Throw grenade (2 remaining)'})
    const box=(await grenade.boundingBox())!,reload=(await page.getByRole('button',{name:'Reload',exact:true}).boundingBox())!
    expect(box.x+box.width).toBeLessThan(reload.x);expect(box.height).toBeGreaterThanOrEqual(44)
    await grenade.tap();await expect(page.getByRole('button',{name:'Throw grenade (1 remaining)'})).toBeVisible()
    await page.screenshot({path:info.outputPath('mobile-grenade-controls.png')})
    await page.waitForTimeout(1100);await page.getByRole('button',{name:'Throw grenade (1 remaining)'}).tap()
    await expect(page.getByRole('button',{name:'Throw grenade (0 remaining)'})).toBeDisabled()
    await page.waitForTimeout(3000);expect(errors).toEqual([])
  }finally{await context.close()}
})

test('Mission gallery previews load, modal closes with Escape and returns focus',async({page})=>{
  await page.goto('/campaign')
  const card=page.getByRole('button',{name:'The last signal',exact:true})
  await expect.poll(()=>card.locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(800)
  await card.click();await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeHidden();await expect(card).toBeFocused()
  await expect(page).toHaveURL('/campaign')
})

test('Controller selects mission cards and can dismiss the briefing without launching',async({page})=>{
  await page.addInitScript(()=>{
    const pad={id:'Campaign controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0,touched:false}))}
    Object.defineProperty(navigator,'getGamepads',{value:()=>[pad]})
  })
  await page.goto('/campaign')
  async function pulse(index:number){
    await page.evaluate(index=>Object.defineProperty(navigator.getGamepads()[0]!.buttons[index],'pressed',{value:true,configurable:true}),index)
    await page.waitForTimeout(100)
    await page.evaluate(index=>Object.defineProperty(navigator.getGamepads()[0]!.buttons[index],'pressed',{value:false,configurable:true}),index)
    await page.waitForTimeout(100)
  }
  await pulse(15);await expect(page.getByRole('button',{name:'Dead freight',exact:true})).toBeFocused()
  await pulse(0);await expect(page.getByRole('dialog')).toContainText('Dead freight')
  await expect(page.getByRole('heading',{name:'Dead freight',exact:true})).toBeFocused()
  await pulse(14);await expect(page.getByRole('button',{name:'Close mission briefing'})).toBeFocused()
  await pulse(0);await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button',{name:'Dead freight',exact:true})).toBeFocused()
  await expect(page).toHaveURL('/campaign')
})
