import { browserAccount } from './accounts'
import { createTestAccount } from '../../scripts/test-account'
import {test,expect} from '@playwright/test'
import {Client,type Room} from '@colyseus/sdk'
import {getNavigation} from '../../apps/match/src/training/navigation.js'
import {COMBAT_WORLD,type Position} from '../../packages/shared/src/index.js'
import type {Combatant} from '../../packages/shared/src/combat.js'
test('a real player walks to Civic Heights and climbs six floors with replicated elevation',async({page},info)=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>{const pad={id:'Landmark tour controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[pad],configurable:true})})
 await browserAccount(page,'citytour')
 await page.goto('/play?mode=online');await page.bringToFront();await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
 await page.evaluate(()=>Object.defineProperty(navigator.getGamepads()[0]!.buttons[0],'pressed',{value:true,configurable:true}));await expect(page.locator('main.arena')).toHaveAttribute('data-phase','playing')
 await page.evaluate(()=>Object.defineProperty(navigator.getGamepads()[0]!.buttons[0],'pressed',{value:false,configurable:true}))
 const id=(await page.locator('main.arena').getAttribute('data-player-id'))!,roomId=(await page.locator('main.arena').getAttribute('data-room-id'))!
 const peerAccount=await createTestAccount('http://127.0.0.1:3001','citypeer')
 const peer:Room<{actors:{get(id:string):Combatant|undefined}}>=await new Client('ws://127.0.0.1:2569').joinById(roomId,{joinToken:await peerAccount.token()})
 peer.onMessage('event',()=>{});peer.onMessage('leaderboard',()=>{})
 const actor=page.locator(`[data-actor="${id}"]`),nav=getNavigation(COMBAT_WORLD);await nav.precompute()
 const position=async()=>({x:Number(await actor.getAttribute('data-x')),y:Number(await actor.getAttribute('data-y')),z:Number(await actor.getAttribute('data-z'))})
 async function axes(x=0,z=0,look=0){await page.evaluate(({x,z,look})=>Object.defineProperty(navigator.getGamepads()[0]!,'axes',{value:[x,z,look,0],configurable:true}),{x,z,look})}
 async function walk(goal:Position){
  const path=nav.findPath(await position(),goal);path.push(goal)
  for(const point of path){
   await expect.poll(async()=>{
    await page.bringToFront();const p=await position(),dx=point.x-p.x,dz=point.z-p.z,d=Math.hypot(dx,dz)
    if(d<.14){await axes();return Math.abs(p.y-point.y)<.3}
    const yaw=Number((await page.getByTestId('heading').innerText()).match(/[0-9]+/)![0])*Math.PI/180,raw=.18+.82*Math.min(1,d/1.2)
    await axes((Math.cos(yaw)*dx-Math.sin(yaw)*dz)/d*raw,-(Math.sin(yaw)*dx+Math.cos(yaw)*dz)/d*raw)
    return false
   },{timeout:10000,intervals:[35],message:`walk ${JSON.stringify(point)}`}).toBe(true).catch(async error=>{console.error('Walk failure', {position:await position(),goal:point,phase:await page.locator('main.arena').getAttribute('data-phase')});await page.screenshot({path:info.outputPath('walk-stalled.png')});throw error})
  }
  await axes();await expect.poll(()=>Math.abs((peer.state?.actors.get(id)?.y ?? -100)-goal.y)).toBeLessThan(.3)
 }
 async function face(degrees:number){await expect.poll(async()=>{const yaw=Number((await page.getByTestId('heading').innerText()).match(/[0-9]+/)![0]),delta=((degrees-yaw+540)%360)-180;if(Math.abs(delta)<2){await axes();return true}await axes(0,0,Math.sign(delta)*.6);return false},{timeout:5000,intervals:[35]}).toBe(true)}
 try {
  await walk({x:94,y:0,z:56});await face(0);await page.screenshot({path:info.outputPath('civic-entrance.png')})
  await walk({x:96.5,y:3.2,z:66});await page.screenshot({path:info.outputPath('civic-upper-floor.png')})
  await walk({x:96.5,y:19.2,z:66});await face(225);await page.screenshot({path:info.outputPath('civic-roof.png')})
  expect(errors).toEqual([])
 }finally{await page.locator('a.brand').click();await expect(page).toHaveURL('/');await expect.poll(()=>peer.state.actors.get(id)).toBeUndefined();peer.reconnection.enabled=false;await peer.leave()}
})
