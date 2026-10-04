import {test,expect,type Page} from '@playwright/test'
async function download(page:Page){
 await page.goto('http://127.0.0.1:3001/')
 await expect(page.getByRole('button',{name:'Download offline play',exact:true})).toBeVisible({timeout:20000})
 await page.getByRole('button',{name:'Download offline play',exact:true}).click()
 await expect(page.getByTestId('offline-ready')).toBeVisible({timeout:60000})
}
for(const mobile of [false,true])test(`downloaded Campaign, Practice and Solo survive offline reload (${mobile?'phone':'desktop'})`,async({browser},info)=>{
 test.setTimeout(150000)
 const context=await browser.newContext(mobile?{viewport:{width:844,height:390},deviceScaleFactor:3,isMobile:true,hasTouch:true}:{}),page=await context.newPage(),errors:string[]=[],sockets:string[]=[]
 page.on('pageerror',error=>errors.push(error.message));page.on('websocket',socket=>sockets.push(socket.url()))
 try{
  await page.goto('http://127.0.0.1:3001/')
  await download(page)
  const cache=await page.evaluate(async()=>{const name=(await caches.keys()).find(n=>n.startsWith('crossline-offline-'))!;const c=await caches.open(name),keys=await c.keys();let bytes=0;for(const key of keys)bytes+=(await (await c.match(key))!.arrayBuffer()).byteLength;return {urls:keys.map(k=>new URL(k.url).pathname),bytes}})
  expect(cache.bytes).toBeLessThanOrEqual(64*1024*1024);expect(cache.urls.length).toBeLessThanOrEqual(97)
  expect(cache.urls.some(url=>url.startsWith('/api/'))).toBe(false)
  const cdp=await context.newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await context.setOffline(true)
  for(const mode of ['training','solo','campaign']){
   await page.goto(`http://127.0.0.1:3001/play?mode=${mode}`)
   await expect(page.locator('.radar-panel')).toContainText('ON DEVICE',{timeout:30000})
   await page.getByRole('button',{name:mode==='campaign'?'Start mission':mode==='solo'?'Start match':'Start training',exact:true}).click()
   await expect(page.locator('main.arena')).toHaveAttribute('data-phase','playing')
   const position=await page.getByTestId('position').innerText()
   if(mobile){
    const stick=(await page.getByTestId('touch-move').boundingBox())!
    await page.mouse.move(stick.x+stick.width/2,stick.y+stick.height/2);await page.mouse.down();await page.mouse.move(stick.x+stick.width/2,stick.y+5)
    await expect(page.getByTestId('position')).not.toHaveText(position);await page.mouse.up()
    await page.getByRole('button',{name:'Aim',exact:true}).tap();await expect(page.getByRole('button',{name:'Aim',exact:true})).toHaveAttribute('aria-pressed','true')
    const look=page.getByTestId('touch-look'),box=(await look.boundingBox())!,heading=await page.getByTestId('heading').innerText()
    await page.mouse.move(box.x+50,box.y+70);await page.mouse.down();await page.mouse.move(box.x+150,box.y+70);await page.mouse.up();await expect(page.getByTestId('heading')).not.toHaveText(heading)
   }else{
    await page.keyboard.down('KeyW');await expect(page.getByTestId('position')).not.toHaveText(position);await page.keyboard.up('KeyW')
    const heading=await page.getByTestId('heading').innerText();await page.mouse.move(150,150);await page.mouse.move(400,180);await expect(page.getByTestId('heading')).not.toHaveText(heading)
    await page.mouse.down({button:'right'})
   }
   if(mode==='solo'){
    await expect(page.locator('[data-actor]')).toHaveCount(13)
    const bot=page.locator('[data-actor="bot-0"]'),before=await bot.getAttribute('data-x');await expect(bot).not.toHaveAttribute('data-x',before!,{timeout:10000})
    await page.waitForTimeout(4100)
   }
   if(mode==='campaign')await expect(page.getByText('SPAWN PROTECTION',{exact:true})).toBeHidden({timeout:6000})
   if(mobile){const fire=(await page.getByRole('button',{name:'Fire',exact:true}).boundingBox())!;await page.mouse.move(fire.x+fire.width/2,fire.y+fire.height/2);await page.mouse.down()}
   else await page.mouse.down()
   await expect(page.getByTestId('ammo')).not.toContainText('24 /')
   if(mobile)await page.mouse.up()
   else{await page.mouse.up();await page.mouse.up({button:'right'})}
   await page.screenshot({path:info.outputPath(`offline-${mode}.png`)})
   if(mobile)await page.getByRole('button',{name:'Pause',exact:true}).tap();else await page.keyboard.press('Escape')
   await page.getByRole('button',{name:'Return to menu',exact:true}).click()
  }
  await page.goto('http://127.0.0.1:3001/campaign');await expect(page.getByRole('heading',{name:'The last signal.'})).toBeVisible()
  await page.goto('http://127.0.0.1:3001/play?mode=online');await expect(page.getByRole('heading',{name:'Online needs internet.'})).toBeVisible()
  expect(sockets).toEqual([]);expect(errors).toEqual([])
  await context.setOffline(false);await page.goto('http://127.0.0.1:3001/');await expect(page.getByTestId('offline-ready')).toBeVisible()
  expect((await page.request.get('/api/arena')).ok()).toBe(true)
  await page.getByRole('button',{name:'Remove offline files',exact:true}).click();await expect(page.getByTestId('offline-ready')).toBeHidden()
 }finally{await context.close()}
})
test('interrupted game downloads are not ready and resume without caching APIs',async({page,context})=>{
 test.setTimeout(90000)
 // Vercel exposes prerendered HTML at its canonical route, not its build filename.
 await context.route('**/offline-shell/index.html',route=>route.fulfill({status:404,body:'not found'}))
 await context.route('**/models/lamoot-ak47.glb',route=>route.abort())
 await page.goto('http://127.0.0.1:3001/');await page.getByRole('button',{name:'Download offline play',exact:true}).click()
 await expect(page.locator('.offline-download [role="alert"]')).toBeVisible({timeout:30000})
 await expect(page.getByTestId('offline-ready')).toBeHidden()
 await context.unroute('**/models/lamoot-ak47.glb')
 await page.getByRole('button',{name:'Download offline play',exact:true}).click()
 await expect(page.getByTestId('offline-ready')).toBeVisible({timeout:60000})
 await context.setOffline(true);await page.reload();await expect(page.getByTestId('offline-ready')).toBeVisible()
 expect(await page.evaluate(async()=>{try{await fetch('/api/auth/get-session');return 'cached'}catch{return 'network-only'}})).toBe('network-only')
})
