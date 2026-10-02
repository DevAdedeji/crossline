import {test,expect} from '@playwright/test'
import {browserAccount} from './accounts'
test('Online predicts through jitter/loss, pauses stalled inputs and resumes explicitly',async({page})=>{
 test.setTimeout(90000)
 await browserAccount(page,'WEAKNET')
 await page.addInitScript(()=>{
  const settings={delay:0,loss:false,blocked:false};Object.assign(window,{networkTest:settings})
  const Native=window.WebSocket;let sent=0,received=0
  window.WebSocket=class extends Native{
   constructor(url:string|URL,protocols?:string|string[]){super(url,protocols)
    Object.defineProperty(this,'onmessage',{set:(handler:(event:MessageEvent)=>void)=>this.addEventListener('message',event=>{
     received++;if(settings.loss&&received%7===0)return
     const delay=settings.delay+(settings.delay?received%3*40:0)
     if(delay)setTimeout(()=>handler(event),delay);else handler(event)
    })})
   }
   override send(data:string|ArrayBufferLike|Blob|ArrayBufferView){
    sent++;if(settings.blocked||(settings.loss&&sent%5===0))return
    const delay=settings.delay+(settings.delay?sent%3*40:0)
    if(delay)setTimeout(()=>{if(this.readyState===Native.OPEN)super.send(data)},delay);else super.send(data)
   }
  }
 })
 await page.goto('/play?mode=online');await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
 await page.getByRole('button',{name:'Enter arena',exact:true}).click();await page.waitForTimeout(4500)
 await page.evaluate(()=>Object.assign((window as unknown as {networkTest:object}).networkTest,{delay:160,loss:true}))
 const start=await page.locator('main.arena').getAttribute('data-client-position')
 await page.keyboard.down('KeyW');await expect(page.locator('main.arena')).not.toHaveAttribute('data-client-position',start!,{timeout:500})
 await page.waitForTimeout(1500);await page.keyboard.up('KeyW')
 await expect(page.getByTestId('network-notice')).toContainText('Weak connection')
 await expect(page.locator('main.arena')).toHaveAttribute('data-phase','playing')
 await page.evaluate(()=>Object.assign((window as unknown as {networkTest:object}).networkTest,{delay:0,loss:false,blocked:true}))
 await page.keyboard.down('KeyW');await page.mouse.down()
 await expect(page.locator('main.arena')).toHaveAttribute('data-network-stalled','true',{timeout:2000})
 await expect(page.getByTestId('network-notice')).toContainText('Controls paused')
 await page.keyboard.up('KeyW');await page.mouse.up()
 await page.evaluate(()=>Object.assign((window as unknown as {networkTest:object}).networkTest,{blocked:false}))
 await expect(page.getByTestId('network-notice')).toContainText('Connection restored',{timeout:5000})
 await expect(page.locator('main.arena')).toHaveAttribute('data-phase','paused')
 await page.getByRole('button',{name:'Resume match',exact:true}).click()
 await expect(page.locator('main.arena')).toHaveAttribute('data-phase','playing')
 await page.waitForTimeout(400);const stopped=await page.getByTestId('position').innerText();await page.waitForTimeout(500);await expect(page.getByTestId('position')).toHaveText(stopped)
})
