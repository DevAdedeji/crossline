import { test, expect } from '@playwright/test'
import { getCampaignMission } from '../../packages/shared/src/campaign'

test('Twenty chapters are grouped into acts, and automatic objectives save and retry their exact step',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/campaign')
  const titles=new Set<string>()
  for(let act=0;act<4;act++){
    await page.getByRole('group',{name:'Campaign acts'}).getByRole('button').nth(act).click()
    const cards=page.getByRole('navigation',{name:'Campaign missions'}).getByRole('button')
    await expect(cards).toHaveCount(5)
    for(const title of await cards.allTextContents())titles.add(title)
  }
  expect(titles.size).toBe(20)
  const mission=getCampaignMission('blackout')
  await page.evaluate(({id,cleared})=>localStorage.setItem(`crossline.campaign.${id}.v1`,JSON.stringify({version:1,missionId:id,checkpoint:'rescue',objectiveIndex:1,cleared,completed:false})),{id:mission.id,cleared:mission.guards.map((_,i)=>`bot-${i}`)})
  await page.goto('/campaign?mission=blackout')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('.objective').filter({hasText:'Isolate the western feed'})).toBeVisible()
  await page.screenshot({path:info.outputPath('campaign-20-chapters.png'),fullPage:true})
  await page.getByRole('button',{name:'Got it, continue'}).click()
  await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
  await expect(page.getByRole('button',{name:'Start mission',exact:true})).toBeHidden()
  await expect(page.locator('.mission-hud')).toHaveAttribute('data-objective','blackout-2')
  await expect(page.locator('.mission-hud')).toHaveAttribute('data-objective','blackout-3',{timeout:8000})
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('crossline.campaign.blackout.v1')!).objectiveIndex)).toBe(2)
  await page.screenshot({path:info.outputPath('blackout-objective.png')})
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Abort mission',exact:true}).click()
  await page.getByRole('button',{name:'Retry checkpoint',exact:true}).click()
  await expect(page.locator('.mission-hud')).toHaveAttribute('data-objective','blackout-3')
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Return to menu',exact:true}).click()
  expect(errors).toEqual([])
})

test('Mobile act selection fits portrait and timed defusal pauses safely in landscape',async({browser},info)=>{
  const context=await browser.newContext({baseURL:'http://127.0.0.1:3001',viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage()
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  try{
    await page.goto('/campaign')
    await page.getByRole('button',{name:/Endgame/}).tap()
    await page.getByRole('button',{name:/Open horizon/}).tap()
    await expect(page.getByRole('heading',{name:'Open horizon'})).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:info.outputPath('campaign-act-four-mobile.png'),fullPage:true})
    const mission=getCampaignMission('cold-water')
    await page.evaluate(({id,cleared})=>localStorage.setItem(`crossline.campaign.${id}.v1`,JSON.stringify({version:1,missionId:id,checkpoint:'rescue',objectiveIndex:1,cleared,completed:false})),{id:mission.id,cleared:mission.guards.map((_,i)=>`bot-${i}`)})
    await page.setViewportSize({width:844,height:390});await page.goto('/play?mode=campaign&mission=cold-water')
    await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
    await page.getByRole('button',{name:'Start mission',exact:true}).tap()
    await expect(page.getByRole('timer')).toContainText('1:59',{timeout:5000})
    await expect(page.locator('[data-waypoint=objective]')).toBeVisible()
    await page.screenshot({path:info.outputPath('cold-water-timer-mobile.png')})
    await page.getByRole('button',{name:'Pause',exact:true}).tap()
    await page.waitForTimeout(1500)
    await page.getByRole('button',{name:'Resume mission',exact:true}).tap()
    await expect(page.getByRole('timer')).toContainText('1:59')
    await page.getByRole('button',{name:'Pause',exact:true}).tap();await page.getByRole('button',{name:'Return to menu',exact:true}).tap()
    expect(errors).toEqual([])
  }finally{await context.close()}
})

for(const scenario of [{id:'chain-reaction',mobile:false},{id:'broken-wing',mobile:true},{id:'white-flag',mobile:true}])test(`${scenario.id} loads its detailed arena in a playable viewport`,async({browser},info)=>{
  const context=await browser.newContext({baseURL:'http://127.0.0.1:3001',viewport:scenario.mobile?{width:844,height:390}:{width:1440,height:900},hasTouch:scenario.mobile,isMobile:scenario.mobile}),page=await context.newPage(),errors:string[]=[]
  page.on('pageerror',e=>errors.push(e.message))
  try{
    await page.goto(`/play?mode=campaign&mission=${scenario.id}`)
    await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
    await page.getByRole('button',{name:'Start mission',exact:true}).click()
    await expect(page.locator('.mission-hud')).toHaveAttribute('data-objective',`${scenario.id}-1`)
    await expect(page.locator('[data-waypoint=objective]')).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:info.outputPath(`${scenario.id}-playable.png`)})
    if(scenario.mobile)await page.getByRole('button',{name:'Pause',exact:true}).click();else await page.keyboard.press('Escape')
    await page.getByRole('button',{name:'Return to menu',exact:true}).click()
    expect(errors).toEqual([])
  }finally{await context.close()}
})
