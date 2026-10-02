import { expect, test, type Page } from '@playwright/test'
async function button(page:Page,index:number,pressed:boolean){await page.evaluate(({index,pressed})=>{Object.defineProperty(navigator.getGamepads()[0]!.buttons[index],'pressed',{value:pressed,configurable:true})},{index,pressed})}
async function pulse(page:Page,index:number){await page.bringToFront();await page.evaluate(async index=>{const b=navigator.getGamepads()[0]!.buttons[index]!;Object.defineProperty(b,'pressed',{value:true,configurable:true});await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));Object.defineProperty(b,'pressed',{value:false,configurable:true});await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())))},index)}
for(const controller of [false,true])test(`Solo health supplies and crouch work with ${controller?'controller':'mouse and keyboard'}`,async({page},info)=>{
 await page.addInitScript(()=>{
  const state=window as unknown as {healAudioPlays:number};state.healAudioPlays=0
  const original=AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start=function(...args:Parameters<AudioBufferSourceNode['start']>){if(this.buffer && Math.abs(this.buffer.duration-.22)<.001)state.healAudioPlays++;return original.apply(this,args)}
 })
 test.setTimeout(60000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 if(controller)await page.addInitScript(()=>{
  const pad={id:'Survival controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0,touched:false}))}
  Object.defineProperty(navigator,'getGamepads',{value:()=>[pad],configurable:true})
 })
 await page.goto('/play?mode=solo');await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
 await expect(page.locator('[data-pack]')).toHaveCount(11)
 if(controller)await pulse(page,0);else await page.getByRole('button',{name:'Start match',exact:true}).click()
 await expect(page.locator('main.arena')).toHaveAttribute('data-phase','playing')
 if(controller)await pulse(page,11);else await page.keyboard.press('KeyC')
 await expect(page.locator('main.arena')).toHaveAttribute('data-crouch','1')
 await expect(page.getByTestId('stance')).toContainText('CROUCHED')
 await expect(page.locator('main.arena')).toHaveAttribute('data-eye-height',/^0\.9/)
 if(controller){await pulse(page,9);await expect(page.getByRole('heading',{name:'Solo vs Bots paused.'})).toBeVisible();await pulse(page,0);await expect(page.locator('main.arena')).toHaveAttribute('data-crouch','1');await pulse(page,11)}
 else {await page.keyboard.press('KeyC');await expect(page.locator('main.arena')).toHaveAttribute('data-crouch','0');await page.keyboard.down('ControlLeft');await expect(page.locator('main.arena')).toHaveAttribute('data-crouch','1');await page.keyboard.up('ControlLeft')}
 await expect(page.locator('main.arena')).toHaveAttribute('data-crouch','0')
 const human=await page.locator('main.arena').getAttribute('data-player-id'),actor=page.locator(`[data-actor="${human}"]`)
 // Fire safely upward after protection to draw a bot through normal human gunfire cues.
 await page.waitForTimeout(4200);await page.bringToFront()
 if(controller){
  await page.evaluate(()=>Object.defineProperty(navigator.getGamepads()[0]!,'axes',{value:[0,0,0,-1],configurable:true}));await page.waitForTimeout(650)
  await page.evaluate(()=>Object.defineProperty(navigator.getGamepads()[0]!,'axes',{value:[0,0,0,0],configurable:true}));await button(page,0,true);await page.waitForTimeout(180);await button(page,0,false)
  await page.evaluate(()=>Object.defineProperty(navigator.getGamepads()[0]!,'axes',{value:[0,0,0,1],configurable:true}));await page.waitForTimeout(650)
  await page.evaluate(()=>Object.defineProperty(navigator.getGamepads()[0]!,'axes',{value:[0,0,0,0],configurable:true}))
 }else{
  await page.evaluate(()=>document.dispatchEvent(new MouseEvent('mousemove',{movementY:-500,bubbles:true})));await page.mouse.down();await page.waitForTimeout(180);await page.mouse.up()
  await page.evaluate(()=>document.dispatchEvent(new MouseEvent('mousemove',{movementY:500,bubbles:true})))
 }
 await expect(page.getByTestId('ammo')).not.toContainText('24 /')
 await expect.poll(async()=>Number(await actor.getAttribute('data-health')),{timeout:25000}).toBeLessThan(100)
 await expect(page.getByRole('progressbar',{name:'Health'})).not.toHaveAttribute('aria-valuenow','100')
 const pack=page.locator('[data-pack="south-cover"]')
 const target={x:Number(await pack.getAttribute('data-x')),z:Number(await pack.getAttribute('data-z'))}
 // Walk normally to the nearby case. Only keyboard/gamepad input is changed, never game state.
 await expect.poll(async()=>{
  const x=Number(await actor.getAttribute('data-x')),z=Number(await actor.getAttribute('data-z'))
  const yaw=Number((await page.getByTestId('heading').innerText()).match(/[0-9]+/)![0])*Math.PI/180
  const dx=target.x-x,dz=target.z-z,d=Math.hypot(dx,dz)
  if(d>.7){
   if(controller)await page.evaluate(({dx,dz,d,yaw})=>{const p=navigator.getGamepads()[0]!;const forward=(Math.sin(yaw)*dx+Math.cos(yaw)*dz)/d,right=(Math.cos(yaw)*dx-Math.sin(yaw)*dz)/d;Object.defineProperty(p,'axes',{value:[right,-forward,0,0],configurable:true})},{dx,dz,d,yaw})
   else {
    const desired=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw))
    await page.evaluate(delta=>document.dispatchEvent(new MouseEvent('mousemove',{movementX:delta/.0024,movementY:0,bubbles:true})),delta)
    await page.keyboard.down('KeyW')
   }
  }
  return await pack.getAttribute('data-ready')
 },{timeout:15000,intervals:[80]}).toBe('false')
 if(controller)await page.evaluate(()=>{const p=navigator.getGamepads()[0]!;Object.defineProperty(p,'axes',{value:[0,0,0,0],configurable:true})});else await page.keyboard.up('KeyW')
 await expect(page.getByTestId('health-feedback')).toContainText('HP · SUPPLIES COLLECTED')
 // Damage can continue during the approach; assert the confirmed gain, not net HP since the first shot.
 const gain=Number((await page.getByTestId('health-feedback').innerText()).match(/\d+/)![0])
 expect(gain).toBeGreaterThan(0);expect(gain).toBeLessThanOrEqual(35)
 expect(Number(await actor.getAttribute('data-health'))).toBeGreaterThan(0)
 expect(Number(await actor.getAttribute('data-health'))).toBeLessThanOrEqual(100)
 expect(await page.evaluate(()=>(window as unknown as {healAudioPlays:number}).healAudioPlays)).toBe(1)
 await page.screenshot({path:info.outputPath(`survival-${controller?'controller':'mouse'}.png`)})
 if(controller)await pulse(page,9);else await page.keyboard.press('Escape')
 await expect(page.getByRole('heading',{name:'Solo vs Bots paused.'})).toBeVisible()
 expect(errors).toEqual([])
})
