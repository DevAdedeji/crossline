import {test,expect} from '@playwright/test'
import {quietCampaign} from './campaign-fixture'
for(const mobile of [false,true])for(const gallery of [false,true])test(`first campaign shot responds immediately on entry and retry (${mobile?'touch':'mouse'}, ${gallery?'gallery':'direct'})`,async({browser})=>{
  const context=await browser.newContext({baseURL:'http://127.0.0.1:3001',viewport:mobile?{width:844,height:390}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile}),page=await context.newPage()
  try{
    await quietCampaign(page)
    if(gallery){
      await page.goto('/campaign?mission=last-signal')
      await page.getByRole('button',{name:'Got it, let’s go'}).click()
    }else{
      await page.goto('/play?mode=campaign')
      await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
      await page.getByRole('button',{name:'Start mission',exact:true}).click()
    }
    await expect(page.locator('main.arena')).toHaveAttribute('data-phase','playing',{timeout:30000})
    for(let attempt=0;attempt<2;attempt++){
      await expect(page.getByText('SPAWN PROTECTION',{exact:true})).toBeVisible()
      const shots=await page.locator('main.arena').getAttribute('data-feedback-shots')
      const began=Date.now()
      if(mobile){
        const fire=(await page.getByRole('button',{name:'Fire',exact:true}).boundingBox())!
        await page.mouse.move(fire.x+fire.width/2,fire.y+fire.height/2);await page.mouse.down()
      }else await page.mouse.down()
      await expect(page.getByTestId('ammo')).not.toContainText('24 /',{timeout:900})
      expect(Date.now()-began).toBeLessThan(1000)
      await expect(page.locator('main.arena')).not.toHaveAttribute('data-feedback-shots',shots!)
      await expect(page.getByText('SPAWN PROTECTION',{exact:true})).toBeHidden()
      await page.mouse.up()
      if(mobile)await page.getByRole('button',{name:'Pause',exact:true}).tap();else await page.keyboard.press('Escape')
      await page.getByRole('button',{name:'Abort mission',exact:true}).click()
      if(!attempt)await page.getByRole('button',{name:'Retry checkpoint',exact:true}).click()
    }
  }finally{await context.close()}
})
