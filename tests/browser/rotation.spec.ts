import {test,expect} from '@playwright/test'
test('standalone phone recovers repeated rotations with stale window dimensions and foreground resume',async({browser},info)=>{
 test.setTimeout(60000)
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:3}),page=await context.newPage(),errors:string[]=[]
 page.on('pageerror',error=>errors.push(error.message))
 try{
  // Reproduce WebKit's transient stale layout values while visualViewport settles correctly.
  await page.addInitScript(()=>{Object.defineProperty(navigator,'standalone',{value:true});Object.defineProperty(window,'innerWidth',{get:()=>390});Object.defineProperty(window,'innerHeight',{get:()=>844})})
  await page.goto('http://127.0.0.1:3001/play?mode=campaign')
  const origin=await page.evaluate(()=>performance.timeOrigin)
  await expect(page.getByRole('dialog',{name:'Rotate phone'})).toBeVisible()
  await page.setViewportSize({width:844,height:390})
  await expect(page.getByRole('dialog',{name:'Rotate phone'})).toBeHidden()
  await expect(page.locator('.radar-panel')).toContainText('ON DEVICE',{timeout:30000})
  await page.getByRole('button',{name:'Start mission',exact:true}).tap()
  const identity=await page.locator('main.arena').getAttribute('data-player-id')
  for(const size of [{width:844,height:390},{width:932,height:430},{width:667,height:375}]){
   const fire=(await page.getByRole('button',{name:'Fire',exact:true}).boundingBox())!
   await page.mouse.move(fire.x+fire.width/2,fire.y+fire.height/2);await page.mouse.down()
   await page.setViewportSize({width:390,height:844});await expect(page.getByRole('dialog',{name:'Rotate phone'})).toBeVisible();await page.mouse.up()
   await expect(page.locator('main.arena')).toHaveAttribute('data-phase','paused')
   await page.setViewportSize(size);await page.evaluate(()=>window.dispatchEvent(new Event('orientationchange')))
   await expect(page.getByRole('dialog',{name:'Rotate phone'})).toBeHidden()
   await expect.poll(()=>page.locator('canvas').evaluate((canvas:HTMLCanvasElement)=>({width:canvas.clientWidth,height:canvas.clientHeight,bufferWidth:canvas.width,bufferHeight:canvas.height}))).toEqual({width:size.width,height:size.height,bufferWidth:Math.floor(size.width*1.5),bufferHeight:Math.floor(size.height*1.5)})
   await page.getByRole('button',{name:'Resume mission',exact:true}).tap()
   await expect(page.locator('main.arena')).toHaveAttribute('data-phase','playing');await expect(page.getByTestId('ammo')).toBeVisible()
   const ammo=await page.getByTestId('ammo').innerText();await page.waitForTimeout(300);await expect(page.getByTestId('ammo')).toHaveText(ammo)
   for(const name of ['Fire','Aim','Pause']){const bounds=(await page.getByRole('button',{name,exact:true}).boundingBox())!;expect(bounds.x+bounds.width).toBeLessThanOrEqual(size.width);expect(bounds.y+bounds.height).toBeLessThanOrEqual(size.height)}
  }
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))})
  await expect(page.locator('main.arena')).toHaveAttribute('data-phase','paused')
  await page.setViewportSize({width:844,height:390})
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pageshow'))})
  await expect(page.getByRole('dialog',{name:'Rotate phone'})).toBeHidden()
  await page.getByRole('button',{name:'Resume mission',exact:true}).tap()
  await expect(page.locator('main.arena')).toHaveAttribute('data-player-id',identity!)
  expect(await page.evaluate(()=>performance.timeOrigin)).toBe(origin)
  const initial=await page.getByTestId('position').innerText(),stick=(await page.getByTestId('touch-move').boundingBox())!
  await page.mouse.move(stick.x+stick.width/2,stick.y+stick.height/2);await page.mouse.down();await page.mouse.move(stick.x+stick.width/2,stick.y+5);await expect(page.getByTestId('position')).not.toHaveText(initial);await page.mouse.up()
  await page.screenshot({path:info.outputPath('rotation-restored.png')});expect(errors).toEqual([])
 }finally{await context.close()}
})
