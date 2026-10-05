/** Map-only visual audit, against pnpm dev; no gameplay hooks in production. */
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test')
const previews=process.env.WRITE_CAMPAIGN_PREVIEWS==='1'
const output=previews?'apps/web/public/campaign':'/tmp/crossline-campaign-audit'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({channel:'chrome'}),results=[]
try {
  const page=await browser.newPage({viewport:{width:800,height:500}}),errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.route('**/__campaign_visuals',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"><canvas style="width:100vw;height:100vh"></canvas></body>'}))
  await page.goto(`${process.env.CROSSLINE_PREVIEW_URL??'http://127.0.0.1:3000'}/__campaign_visuals`)
  const ids=await page.evaluate(async root=>{
    const [{createUrbanScene},{loadTrainingAssets},{CAMPAIGN_MISSIONS}]=await Promise.all([import('/_nuxt/game/createUrbanScene.ts'),import('/_nuxt/game/trainingAssets.ts'),import(`/_nuxt/@fs${root}/packages/shared/src/campaign.ts`)])
    window.audit={createUrbanScene,loadTrainingAssets,missions:CAMPAIGN_MISSIONS}
    return CAMPAIGN_MISSIONS.map(m=>m.id)
  },process.cwd())
  for(const id of ids.filter(id=>!process.env.AUDIT_MISSIONS||process.env.AUDIT_MISSIONS.split(',').includes(id))){
    const stats=await page.evaluate(async id=>{
      const a=window.audit;a.arena?.engine.dispose()
      const m=a.missions.find(m=>m.id===id),arena=a.createUrbanScene(document.querySelector('canvas'),m.world)
      a.arena=arena;arena.addVehicles(await a.loadTrainingAssets(arena.scene))
      const b=m.world.buildings[0],center=m.world.environment==='airfield'?(m.tasks?.find(t=>t.kind==='defend')?.position??m.relay):{x:b.x,z:b.z}
      const dz=m.world.environment==='airfield'?38:b.depth/2+18
      const view=m.world.place?.preview
      arena.camera.position.set(...(view?.eye??[center.x+18,7,center.z-dz]))
      arena.camera.setTarget(new arena.camera.position.constructor(...(view?.target??[center.x,2.8,center.z])))
      await arena.scene.whenReadyAsync();arena.engine.runRenderLoop(()=>arena.scene.render())
      return {buildings:m.world.buildings.length,guards:m.guards.length}
    },id)
    await page.waitForTimeout(700)
    await page.screenshot(previews?{path:`${output}/${id}.jpg`,type:'jpeg',quality:84}:{path:`${output}/${id}.png`})
    results.push({id,...stats});console.log(id)
  }
  console.log(JSON.stringify({results,errors},null,2))
} finally {await browser.close()}
