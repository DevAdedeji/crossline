/** Static map-only render profile against pnpm dev on loopback: no actors or simulated phone hardware. */
import assert from 'node:assert/strict'
import {createRequire} from 'node:module';const {chromium}=createRequire(new URL('../package.json',import.meta.url))('@playwright/test');
const browser=await chromium.launch({channel:'chrome'}),results=[];
try{for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:mobile?{width:844,height:390}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/WebGL: (context lost|INVALID_OPERATION)/.test(m.text()))errors.push(m.text())});
 await page.route('**/__visuals',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"><canvas style="width:100vw;height:100vh"></canvas></body>'}));await page.goto(`${process.env.CROSSLINE_PREVIEW_URL ?? 'http://127.0.0.1:3000'}/__visuals`);
  await page.evaluate(async ({mobile,root})=>{const [{createUrbanScene},{loadTrainingAssets},{COMBAT_WORLD}]=await Promise.all([import('/_nuxt/game/createUrbanScene.ts'),import('/_nuxt/game/trainingAssets.ts'),import(`/_nuxt/@fs${root}/packages/shared/src/index.ts`)]);const arena=createUrbanScene(document.querySelector('canvas'),COMBAT_WORLD,{mobile});const assets=await loadTrainingAssets(arena.scene,{mobile});await arena.addVehicles(assets);await arena.scene.whenReadyAsync();arena.engine.runRenderLoop(()=>arena.scene.render());window.visuals=arena},{mobile,root:process.cwd()});
 const memory=await page.evaluate(()=>{
  const {scene,engine}=window.visuals
  // RGBA8 + mip estimate, not a measurement of total process/GPU memory.
  return {meshes:scene.meshes.length,fov:scene.activeCamera.fov,textureMiB:engine.getLoadedTexturesCache().reduce((n,t)=>n+t.width*t.height*4*(t.generateMipMaps?4/3:1),0)/2**20,plasterTextures:scene.textures.filter(t=>t.name==='surface-plaster').length}
 })
 assert.equal(memory.plasterTextures,1)
 assert.equal(memory.fov,mobile?.95:1.2)
 if(mobile){assert.ok(memory.textureMiB<200,`Mobile map textures exceed 200 MiB: ${memory.textureMiB}`);assert.ok(memory.meshes<3200,`Mobile map exceeds 3200 mesh batches: ${memory.meshes}`)}
 results.push({mobile,...memory})
 for(const shot of [{name:'city-street',p:[112,1.6,37],t:[94,8,66]},{name:'city-interior',p:[96.5,1.6,66],t:[88,3,66]},{name:'city-roof',p:[96.5,20.8,66],t:[0,3,48]}]){
  await page.evaluate(s=>{const a=window.visuals;a.camera.position.set(...s.p);a.camera.setTarget(new a.camera.position.constructor(...s.t))},shot);await page.waitForTimeout(500);
  const metrics=await page.evaluate(()=>new Promise(resolve=>{const samples=[];let previous=performance.now(),start=previous;function step(t){samples.push(t-previous);previous=t;if(t-start<4000)requestAnimationFrame(step);else{samples.sort((a,b)=>a-b);resolve({fps:1000/(samples.reduce((a,b)=>a+b,0)/samples.length),p95:samples[Math.floor(samples.length*.95)],over50:samples.filter(t=>t>50).length,meshes:window.visuals.scene.getActiveMeshes().length})}}requestAnimationFrame(step)}));
  const first=await page.screenshot();await page.waitForTimeout(150);const second=await page.screenshot({path:`/tmp/crossline-${mobile?'phone':'desktop'}-${shot.name}.png`});results.push({mobile,view:shot.name,...metrics,staticFramesIdentical:first.equals(second)});
 }
 assert.deepEqual(errors,[]);results.push({mobile,errors,browser:browser.version(),renderer:await page.evaluate(()=>{const gl=window.visuals.engine._gl,ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable'})});await context.close();
}}finally{await browser.close()}console.log(JSON.stringify(results,null,2));
