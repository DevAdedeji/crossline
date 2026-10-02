import {test,expect} from '@playwright/test'
for(const scenario of [{width:667,height:375,mode:'training'},{width:932,height:430,mode:'online'}])test(`landscape ${scenario.width}px touch controls support simultaneous movement look and fire`,async({browser},info)=>{
 test.setTimeout(60000)
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}),page=await context.newPage(),errors:string[]=[]
 page.on('pageerror',e=>errors.push(e.message))
 try{
  await page.addInitScript(()=>{const Original=window.AudioContext;const contexts:AudioContext[]=[];(window as unknown as {testAudio:AudioContext[]}).testAudio=contexts;window.AudioContext=class extends Original{constructor(options?:AudioContextOptions){super(options);contexts.push(this)}}})
  await page.goto(`http://127.0.0.1:3001/play${scenario.mode==='online'?'?mode=online':''}`)
  await expect(page.getByRole('dialog',{name:'Rotate phone'})).toBeVisible()
  await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
  await page.setViewportSize({width:scenario.width,height:scenario.height})
  await expect(page.getByRole('dialog',{name:'Rotate phone'})).toBeHidden()
  await page.getByRole('button',{name:scenario.mode==='online'?'Enter arena':'Start training',exact:true}).tap()
  await expect(page.getByRole('button',{name:'Fire',exact:true})).toBeVisible()
  expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true)
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {testAudio:AudioContext[]}).testAudio.every(c=>c.state==='running'))).toBe(true)
  await expect(page.getByText('SPAWN PROTECTION',{exact:true})).toBeHidden({timeout:6000})
  for(const name of ['Fire','Aim','Reload','Crouch','Pause']){const box=await page.getByRole('button',{name,exact:true}).boundingBox();expect(box).toBeTruthy();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(scenario.width);expect(box!.y+box!.height).toBeLessThanOrEqual(scenario.height)}
  const id=await page.locator('main.arena').getAttribute('data-player-id'),actor=page.locator(`[data-actor="${id}"]`)
  const initial={x:Number(await actor.getAttribute('data-x')),z:Number(await actor.getAttribute('data-z')),heading:await page.getByTestId('heading').innerText()}
  const stick=(await page.getByTestId('touch-move').boundingBox())!,fire=(await page.getByRole('button',{name:'Fire',exact:true}).boundingBox())!,look=(await page.getByTestId('touch-look').boundingBox())!
  const cdp=await context.newCDPSession(page)
  const contacts=[{id:1,x:stick.x+stick.width/2,y:stick.y+stick.height/2},{id:2,x:look.x+30,y:look.y+65},{id:3,x:fire.x+fire.width/2,y:fire.y+fire.height/2}]
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:contacts})
  contacts[0]!.y-=28;contacts[0]!.x+=15;contacts[1]!.x+=65;contacts[1]!.y+=12
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:contacts})
  await expect(page.getByTestId('ammo')).not.toContainText('24 /')
  await page.waitForTimeout(650)
  expect(Math.hypot(Number(await actor.getAttribute('data-x'))-initial.x,Number(await actor.getAttribute('data-z'))-initial.z)).toBeGreaterThan(1)
  expect(await page.getByTestId('heading').innerText()).not.toEqual(initial.heading)
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]})
  await page.waitForTimeout(200);const ammo=(await page.getByTestId('ammo').innerText())!,stopped=await actor.getAttribute('data-z')
  await page.waitForTimeout(300);await expect(page.getByTestId('ammo')).toHaveText(ammo);expect(await actor.getAttribute('data-z')).toBe(stopped)
  await page.getByRole('button',{name:'Aim',exact:true}).tap();await expect(page.getByRole('button',{name:'Aim',exact:true})).toHaveAttribute('aria-pressed','true')
  await page.getByRole('button',{name:'Crouch',exact:true}).tap();await expect(page.locator('main.arena')).toHaveAttribute('data-crouch','1')
  await page.getByRole('button',{name:'Reload',exact:true}).tap();await expect(page.getByTestId('ammo')).toContainText('24 /',{timeout:5000})
  await page.screenshot({path:info.outputPath(`landscape-${scenario.width}.png`)})
  expect(await page.evaluate(()=>({scroll:scrollY,overflow:document.documentElement.scrollWidth>innerWidth}))).toEqual({scroll:0,overflow:false})
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[contacts[0]!,contacts[2]!]})
  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('dialog',{name:'Rotate phone'})).toBeVisible()
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]})
  await expect(page.locator('main.arena')).toHaveAttribute('data-phase','paused')
  await page.setViewportSize({width:scenario.width,height:scenario.height});await page.getByRole('button',{name:scenario.mode==='online'?'Resume match':'Resume training',exact:true}).tap()
  await expect(page.getByTestId('ammo')).toBeVisible();await expect(page.getByTestId('ammo')).toHaveText(/\d+ \/ ∞/);const resumed=(await page.getByTestId('ammo').innerText())!;await page.waitForTimeout(350);await expect(page.getByTestId('ammo')).toHaveText(resumed)
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(page.locator('main.arena')).toHaveAttribute('data-phase','paused')
  await page.getByRole('button',{name:'Return to menu',exact:true}).tap();await expect(page).toHaveURL('http://127.0.0.1:3001/')
  expect(errors).toEqual([])
 }finally{await context.close()}
})
