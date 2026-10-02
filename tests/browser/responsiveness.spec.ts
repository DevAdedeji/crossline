import {test,expect} from '@playwright/test'
test('movement and muzzle feedback react before a delayed authority update',async({page})=>{
 test.setTimeout(90000)
 await page.addInitScript(()=>{
  const Native=window.WebSocket
  window.WebSocket=class extends Native {
   override send(data:string|ArrayBufferLike|Blob|ArrayBufferView){const delay=(window as unknown as {testInputDelay?:number}).testInputDelay ?? 0;if(!delay){super.send(data);return}setTimeout(()=>{if(this.readyState===Native.OPEN)super.send(data)},delay)}
  }
 })
  await page.goto('/play');await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:60000})
  await page.getByRole('button',{name:'Start training',exact:true}).click()
  await expect(page.locator('main.arena')).toHaveAttribute('data-phase','playing')
  await page.waitForTimeout(500)
  await page.evaluate(()=>{(window as unknown as {testInputDelay:number}).testInputDelay=300})
  const metrics=await page.evaluate(()=>new Promise<{move:number;shot:number;authority:number}>(resolve=>{
   const arena=document.querySelector('main.arena')!,position=document.querySelector('[data-testid="position"]')!,start=performance.now(),initial=arena.getAttribute('data-client-position'),server=position.textContent,shot=arena.getAttribute('data-feedback-shots');let move=0,fire=0,authority=0
   document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));document.dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true}))
   function poll(){const time=performance.now()-start;if(!move&&arena.getAttribute('data-client-position')!==initial)move=time;if(!fire&&arena.getAttribute('data-feedback-shots')!==shot)fire=time;if(!authority&&position.textContent!==server)authority=time;if(move&&fire&&authority||time>1500){document.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));document.dispatchEvent(new MouseEvent('mouseup',{button:0,bubbles:true}));resolve({move,shot:fire,authority})}else requestAnimationFrame(poll)}requestAnimationFrame(poll)
  }))
  console.log('Delayed connection response (ms):',metrics)
  expect(metrics.move).toBeGreaterThan(0);expect(metrics.move).toBeLessThan(100)
  expect(metrics.shot).toBeGreaterThan(0);expect(metrics.shot).toBeLessThan(100)
  expect(metrics.authority).toBeGreaterThan(250)
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Return to menu',exact:true}).click();await expect(page).toHaveURL('/')
})
test('high-density phone renders clearly at 1.5 pixels per CSS pixel',async({browser})=>{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:3}),page=await context.newPage()
 try{
  await page.goto('http://127.0.0.1:3001/play');await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:60000})
  const size=await page.locator('canvas').evaluate((canvas:HTMLCanvasElement)=>({width:canvas.width,height:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight}))
  expect(size.width/size.cssWidth).toBeCloseTo(1.5,1);expect(size.height/size.cssHeight).toBeCloseTo(1.5,1)
 }finally{await context.close()}
})
