import {test,expect} from '@playwright/test'
import {quietCampaign} from './campaign-fixture'

for(const size of [{width:667,height:375},{width:852,height:402},{width:932,height:430}])test(`phone ${size.width}px mission banner clears the map and landscape safe area`,async({browser},info)=>{
 const context=await browser.newContext({viewport:size,isMobile:true,hasTouch:true,deviceScaleFactor:3}),page=await context.newPage()
 try{
  await quietCampaign(page)
  await page.goto('/play?mode=campaign')
  await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
  await page.getByRole('button',{name:'Start mission',exact:true}).tap()
  const objective=page.getByRole('region',{name:'Mission objective'})
  await expect(objective).toBeVisible()
  // Browser emulation has no hardware cutout; exercise the shared landscape inset.
  for(const inset of [0,62]){
   await page.locator('main.arena').evaluate((arena,inset)=>(arena as HTMLElement).style.setProperty('--hud-safe-left',`${inset}px`),inset)
   const map=(await page.locator('.radar-panel').boundingBox())!,banner=(await objective.boundingBox())!
   expect(map.x).toBeGreaterThanOrEqual(inset)
   expect(banner.x).toBeGreaterThanOrEqual(map.x+map.width+12)
   expect(banner.x+banner.width).toBeLessThan(size.width-90)
   expect(banner.y).toBe(map.y)
   expect(banner.height).toBeGreaterThan(40)
  }
  await page.screenshot({path:info.outputPath('mobile-safe-area.png')})
 }finally{await context.close()}
})
