import {COMBAT_WORLD,move,TICK_MS} from '../../packages/shared/src/index'
import {browserAccount} from './accounts'
import {test,expect} from '@playwright/test'
test('movement and muzzle feedback react before a delayed authority update',async({page})=>{
 test.setTimeout(90000)
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 await page.addInitScript(()=>{
  const Native=window.WebSocket
  window.WebSocket=class extends Native {
   override send(data:string|ArrayBufferLike|Blob|ArrayBufferView){const delay=(window as unknown as {testInputDelay?:number}).testInputDelay ?? 0;if(!delay){super.send(data);return}setTimeout(()=>{if(this.readyState===Native.OPEN)super.send(data)},delay)}
  }
 })
  await browserAccount(page,'LATENCY')
  await page.goto('/play?mode=online');await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:60000})
  await page.getByRole('button',{name:'Enter arena',exact:true}).click()
  await expect(page.locator('main.arena')).toHaveAttribute('data-phase','playing')
  await page.waitForTimeout(4500)
  // Spawn selection can face a nearby wall. Measure responsiveness in an open
  // direction, rather than expecting input to pass through collision geometry.
  const state=await page.evaluate(()=>{const id=document.querySelector('main.arena')!.getAttribute('data-player-id'),a=document.querySelector(`[data-actor="${id}"]`)!;return {x:Number(a.getAttribute('data-x')),y:Number(a.getAttribute('data-y')),z:Number(a.getAttribute('data-z')),yaw:Number(document.querySelector('[data-testid=heading]')!.textContent!.match(/[0-9]+/)![0])*Math.PI/180}})
  const key=['KeyW','KeyD','KeyS','KeyA'].map((code,i)=>{let p={x:state.x,y:state.y,z:state.z};const angle=state.yaw+i*Math.PI/2;for(let tick=0;tick<10;tick++)p=move(p,{x:Math.sin(angle),z:Math.cos(angle)},TICK_MS,COMBAT_WORLD);return {code,distance:Math.hypot(p.x-state.x,p.z-state.z)}}).sort((a,b)=>b.distance-a.distance)[0]!
  expect(key.distance).toBeGreaterThan(1)
  await page.evaluate(()=>{(window as unknown as {testInputDelay:number}).testInputDelay=300})
  const metrics=await page.evaluate(code=>new Promise<{move:number;shot:number;authority:number}>(resolve=>{
   const arena=document.querySelector('main.arena')!,position=document.querySelector('[data-testid="position"]')!,start=performance.now(),initial=arena.getAttribute('data-client-position'),server=position.textContent,shot=arena.getAttribute('data-feedback-shots');let move=0,fire=0,authority=0
   document.body.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));document.dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true}))
   function poll(){const time=performance.now()-start;if(!move&&arena.getAttribute('data-client-position')!==initial)move=time;if(!fire&&arena.getAttribute('data-feedback-shots')!==shot)fire=time;if(!authority&&position.textContent!==server)authority=time;if(move&&fire&&authority||time>1500){document.body.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));document.dispatchEvent(new MouseEvent('mouseup',{button:0,bubbles:true}));resolve({move,shot:fire,authority})}else requestAnimationFrame(poll)}requestAnimationFrame(poll)
  }),key.code)
  console.log('Delayed connection response (ms):',metrics)
  expect(metrics.move).toBeGreaterThan(0);expect(metrics.move).toBeLessThan(100)
  expect(metrics.shot).toBeGreaterThan(0);expect(metrics.shot).toBeLessThan(100)
  expect(metrics.authority).toBeGreaterThan(250)
  expect(errors).toEqual([])
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Return to menu',exact:true}).click();await expect(page).toHaveURL('/')
})
test('high-density phone renders clearly at 1.5 pixels per CSS pixel',async({browser})=>{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:3}),page=await context.newPage()
 try{
  await page.goto('http://127.0.0.1:3001/play?mode=campaign');await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:60000})
  const size=await page.locator('canvas').evaluate((canvas:HTMLCanvasElement)=>({width:canvas.width,height:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight}))
  expect(size.width/size.cssWidth).toBeCloseTo(1.5,1);expect(size.height/size.cssHeight).toBeCloseTo(1.5,1)
 }finally{await context.close()}
})

test('gameplay stays unobscured through aim, pause and resume',async({page},info)=>{
 await page.goto('/play?mode=campaign');await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:60000})
 await page.getByRole('button',{name:'Start mission',exact:true}).click()
 await expect(page.locator('.overlay')).toHaveCount(0)
 await page.mouse.down({button:'right'});await page.waitForTimeout(200)
 await expect(page.locator('.overlay')).toHaveCount(0);await page.mouse.up({button:'right'})
 const canvas=(await page.locator('canvas').boundingBox())!,header=(await page.locator('header').boundingBox())!,footer=(await page.locator('footer').boundingBox())!
 const sightline=canvas.y+canvas.height/2
 expect(header.y+header.height).toBeLessThan(sightline);expect(footer.y).toBeGreaterThan(sightline)
 await page.screenshot({path:info.outputPath('clear-gameplay.png')})
 await page.keyboard.press('Escape');await expect(page.locator('.overlay')).toBeVisible()
 await page.getByRole('button',{name:'Resume mission',exact:true}).click()
 await expect(page.locator('main.arena')).toHaveAttribute('data-phase','playing')
 await expect(page.locator('.overlay')).toHaveCount(0)
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Return to menu',exact:true}).click()
})

test('cold entry avoids a flood of tiny engine script requests',async({page})=>{
 const scripts=new Set<string>()
 page.on('request',request=>{if(request.resourceType()==='script')scripts.add(new URL(request.url()).pathname)})
 await page.goto('/play?mode=campaign')
 await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:60000})
 console.log('Cold entry script requests:',scripts.size)
 expect(scripts.size).toBeLessThan(40)
})
