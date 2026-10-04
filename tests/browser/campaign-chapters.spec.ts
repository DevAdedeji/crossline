import { test, expect } from '@playwright/test'
import { getCampaignMission } from '../../packages/shared/src/campaign'
for (const scenario of [{id:'dead-freight',mobile:false},{id:'safe-passage',mobile:true}]) test(`${scenario.id} has its own briefing, arena and checkpoint`,async({browser},info)=>{
  const mission=getCampaignMission(scenario.id)
  const context=await browser.newContext({baseURL:'http://127.0.0.1:3001',viewport:scenario.mobile?{width:844,height:390}:{width:1440,height:900},hasTouch:scenario.mobile,isMobile:scenario.mobile})
  const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  try{
    await page.goto('/campaign')
    await page.evaluate(({id,cleared})=>{
      localStorage.setItem(`crossline.campaign.${id}.v1`,JSON.stringify({version:1,missionId:id,checkpoint:'extract',cleared,completed:false,elapsedMs:30000}))
      localStorage.setItem('crossline.campaign.last-signal.v1',JSON.stringify({version:1,checkpoint:'rescue',cleared:[],completed:false}))
    },{id:mission.id,cleared:mission.guards.map((_,i)=>`bot-${i}`)})
    await page.getByRole('link',{name:new RegExp(mission.title,'i')}).click()
    await expect(page.getByRole('heading',{name:mission.title+'.',exact:true})).toBeVisible()
    await expect(page.getByText(`Checkpoint available · ${mission.objectives.extract.title}`)).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:info.outputPath(`${mission.id}-briefing.png`)})
    await page.getByRole('button',{name:/^Continue mission/}).click()
    await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
    await page.getByRole('button',{name:'Start mission',exact:true}).click()
    await expect(page.locator('.mission-hud')).toContainText(mission.objectives.extract.title)
    await expect(page.locator('[data-waypoint=extraction]')).toBeVisible()
    await page.screenshot({path:info.outputPath(`${mission.id}-checkpoint.png`)})
    if(scenario.mobile)await page.getByRole('button',{name:'Pause',exact:true}).click();else await page.keyboard.press('Escape')
    await page.getByRole('button',{name:'Return to menu',exact:true}).click()
    await page.goto(`/play?mode=campaign&mission=${mission.id}`)
    // Fresh insertion gives a view of the new arena instead of an indoor checkpoint.
    await page.evaluate(id=>localStorage.removeItem(`crossline.campaign.${id}.v1`),mission.id);await page.reload()
    await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
    await page.getByRole('button',{name:'Start mission',exact:true}).click()
    await expect(page.locator('.mission-hud')).toContainText(mission.objectives.relay.title)
    await page.screenshot({path:info.outputPath(`${mission.id}-arena.png`)})
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('crossline.campaign.last-signal.v1')!).checkpoint)).toBe('rescue')
    expect(errors).toEqual([])
  }finally{await context.close()}
})
