import {test,expect} from '@playwright/test'
import {browserAccount} from './accounts'

test('standalone phone joins, shoots, leaves and rejoins Online with mobile assets',async({browser})=>{
 test.setTimeout(120000)
 const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:3})
 const page=await context.newPage(),errors:string[]=[],models:string[]=[]
  page.on('pageerror',error=>{
   // Colyseus probes Node's headers overload inside try/catch, then opens a
   // standard browser socket. WebKit reports that caught probe as a page error.
   if(error.message!=="Wrong protocol for WebSocket '[object Object]'")errors.push(error.message)
  })
  page.on('console',message=>{
   // Explicit teardown may release a context WebKit already removed with its
   // canvas. Rendering/texture-binding errors must still fail this regression.
   const text=message.text()
   if(/WebGL: INVALID_OPERATION/.test(text)&&text!=='WebGL: INVALID_OPERATION: loseContext: context already lost')errors.push(text)
  })
 page.on('request',request=>{if(request.url().endsWith('.glb'))models.push(new URL(request.url()).pathname)})
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}))
 try{
  await browserAccount(page,'mobilememory')
  let origin=0
  for(let visit=0;visit<2;visit++){
   if(visit===0){
    await page.goto('/play?mode=online')
    origin=await page.evaluate(()=>performance.timeOrigin)
   }else{
    await expect(page.getByRole('button',{name:'mobilememory · LOG OUT',exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Online Free-for-All',exact:true}).tap()
   }
   await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:45000})
   if(visit===0)await page.getByRole('button',{name:'Enter arena',exact:true}).tap()
   await expect(page.locator('main.arena')).toHaveAttribute('data-phase','playing')
   const rendering=await page.locator('canvas').evaluate((canvas:HTMLCanvasElement)=>{
    const gl=canvas.getContext('webgl2')??canvas.getContext('webgl')
    return {lost:gl?.isContextLost(),antialias:gl?.getContextAttributes()?.antialias,width:canvas.width,height:canvas.height}
   })
   expect(rendering).toEqual({lost:false,antialias:false,width:1266,height:585})
   await expect(page.getByText('SPAWN PROTECTION',{exact:true})).toBeHidden({timeout:6000})
   const fire=(await page.getByRole('button',{name:'Fire',exact:true}).boundingBox())!
   await page.mouse.move(fire.x+fire.width/2,fire.y+fire.height/2)
   await page.mouse.down()
   await expect(page.getByTestId('ammo')).not.toContainText('24 /')
   await page.mouse.up()
   await page.getByRole('button',{name:'Pause',exact:true}).tap()
   await page.getByRole('button',{name:'Return to menu',exact:true}).click()
   await expect(page).toHaveURL('http://127.0.0.1:3001/')
   // WebKit's timer privacy rounding can vary by 1ms within one document.
   expect(Math.abs(await page.evaluate(()=>performance.timeOrigin)-origin)).toBeLessThanOrEqual(2)
  }
  expect(new Set(models.filter(url=>url.endsWith('-mobile.glb'))).size).toBe(5)
  expect(models.some(url=>/\/(polyhaven-.+|rocketbox-soldier)\.glb$/.test(url)&&!url.endsWith('-mobile.glb'))).toBe(false)
  expect(errors).toEqual([])
 }finally{await context.close()}
})
