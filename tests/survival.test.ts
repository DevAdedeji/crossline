import test from 'node:test'
import assert from 'node:assert/strict'
import { TrainingGame } from '../apps/match/src/training/TrainingGame.js'
import { getNavigation } from '../apps/match/src/training/navigation.js'
import { SOLO, SOLO_HEALTH_PACKS, COMBAT_WORLD, TRAINING_WORLD, TICK_MS, CROUCH, stanceEye, stanceHeight, isBlocked, move, type WorldGeometry } from '../packages/shared/src/index.js'
import { actorHit, parseCombatInput, RIFLE } from '../packages/shared/src/combat.js'
const idle={x:0,z:0,yaw:0,pitch:0,fire:false,aim:false,crouch:false}
function game(mode:'solo'|'training'|'online'='solo') {
 const g=new TrainingGame('human',180000,()=>.5,mode)
 if(mode==='online'){g.addHuman('human','HUMAN');g.enterHuman('human')}
 for(const [id,a] of g.actors)if(a.bot)g.actors.delete(id)
 g.start();g.elapsed=5000;return g
}
function run(g:TrainingGame,ms:number){for(let t=0;t<ms;t+=TICK_MS)g.step()}
test('Solo packs heal partial HP, cap at 100, leave full/dead players alone and respect cooldown/reset',()=>{
 const g=game(),human=g.actors.get('human')!,pack=g.healthPacks.get('supply-door')!
 Object.assign(human,{x:pack.x,y:pack.y,z:pack.z,health:100});g.step()
 assert.equal(pack.availableAt,0)
 human.health=40;g.step();assert.equal(human.health,75);assert.ok(pack.availableAt>g.elapsed)
 assert.equal(g.drainEvents().filter(e=>e.type==='heal').length,1)
 run(g,2000);assert.equal(human.health,75,'no passive human regeneration in Solo')
 human.health=90;g.elapsed=pack.availableAt;g.step();assert.equal(human.health,100)
 const event=g.drainEvents().find(e=>e.type==='heal');assert.ok(event?.type==='heal');assert.equal(event.amount,10)
 g.elapsed=pack.availableAt;human.health=0;human.respawnUntil=g.elapsed+1000;g.step();assert.equal(human.health,0)
 run(g,1100);assert.equal(human.health,100);assert.ok(human.protectedUntil-g.elapsed>2800)
 assert.equal(pack.availableAt<=g.elapsed,true,'death does not consume supplies')
 g.restart();assert.ok([...g.healthPacks.values()].every(p=>p.availableAt===0));assert.equal(g.elapsed,0)
 assert.equal(game('training').healthPacks.size,0);assert.equal(game('online').healthPacks.size,0)
})
test('pickup collection requires same floor, radius, line of sight, life and one authoritative claim',()=>{
 const g=game(),human=g.actors.get('human')!,pack=g.healthPacks.get('supply-door')!
 Object.assign(human,{x:pack.x,y:4.1,z:pack.z,health:20});g.step();assert.equal(human.health,20)
 Object.assign(human,{x:pack.x+SOLO.pickupRadius+.2,y:0,z:pack.z});g.step();assert.equal(human.health,20)
 // Existing store east wall at x=-8 separates two positions within pickup radius.
 Object.assign(pack,{x:-8.5,y:0,z:-15});Object.assign(human,{x:-7.45,y:0,z:-15});g.step();assert.equal(human.health,20)
 Object.assign(pack,{x:-6.5,y:0,z:-13});Object.assign(human,{x:pack.x,y:0,z:pack.z})
 const second={...human,id:'second'};g.actors.set(second.id,second);g.step()
 assert.equal(human.health,55);assert.equal(second.health,20)
 assert.equal(g.drainEvents().filter(e=>e.type==='heal').length,1)
 g.acceptInput({...idle,health:100,pickupId:pack.id});g.step();assert.equal(human.health,55)
})
test('all health cases are grounded, outside collision, and reachable from the connected navigation graph',async()=>{
 const nav=getNavigation(COMBAT_WORLD);await nav.precompute()
 for(const pack of SOLO_HEALTH_PACKS){
  assert.equal(pack.y,0);assert.equal(isBlocked(pack,COMBAT_WORLD),false,pack.id)
  const path=nav.findPath({x:0,y:0,z:-21},pack)
  assert.ok(nav.canWalk(path.at(-1)!,pack),pack.id)
  for(let i=1;i<path.length;i++)assert.ok(nav.canWalk(path[i-1]!,path[i]!),pack.id)
 }
})
test('crouch changes server eye/hit region and speed in every mode; forged stance input is rejected',()=>{
 for(const mode of ['training','solo','online'] as const){
  const g=game(mode),human=g.actors.get('human')!
  Object.assign(human,{x:0,y:0,z:-21,protectedUntil:0});g.acceptInput({...idle,crouch:true},human.id);run(g,250)
  assert.equal(human.crouch,1);assert.ok(Math.abs(stanceEye(human)-CROUCH.eye)<1e-6)
  const before=human.z;g.acceptInput({...idle,z:1,crouch:true},human.id);run(g,1000)
  assert.ok(human.z-before>3&&human.z-before<3.7)
  assert.equal(actorHit({x:0,y:1.5,z:human.z-3},{x:0,y:0,z:1},human,10),null)
  g.acceptInput({...idle,crouch:false},human.id);run(g,250);assert.equal(human.crouch,0)
  assert.notEqual(actorHit({x:0,y:1.5,z:human.z-3},{x:0,y:0,z:1},human,10),null)
  g.acceptInput({...idle,crouch:true},human.id);run(g,250);human.lastShot=-1000
  assert.equal(g.fire(human,0,0,true),true)
  const shot=g.drainEvents().find(e=>e.type==='shot');assert.ok(shot?.type==='shot');assert.ok(Math.abs(shot.start.y-human.y-CROUCH.eye)<1e-6)
  assert.equal(parseCombatInput({...idle,crouch:1}),null)
  human.health=0;human.respawnUntil=g.elapsed;g.step();assert.equal(human.crouch,0)
 }
})
test('crouched bodies fit under overhead cover but cannot stand or move through walls',()=>{
 const g=game('training'),human=g.actors.get('human')!
 const world:WorldGeometry={...TRAINING_WORLD,colliders:[{id:'overhead',x:0,y:1.4,z:0,width:4,depth:4,height:.4,material:'metal'}],solids:[],cars:[],buildings:[]}
 Object.defineProperty(g,'world',{value:world})
 Object.assign(human,{x:0,y:0,z:0,crouch:1})
 assert.equal(isBlocked(human,world),true);assert.equal(isBlocked(human,world,stanceHeight(human)),false)
 g.acceptInput(idle);run(g,400);assert.equal(human.crouch,1)
 g.acceptInput({...idle,z:1,crouch:true});run(g,1000);assert.ok(human.z>2.4)
 g.acceptInput(idle);run(g,250);assert.equal(human.crouch,0)
 let p={x:-3,y:0,z:-16};for(let i=0;i<100;i++)p=move(p,{x:0,z:1},TICK_MS,TRAINING_WORLD,CROUCH.height)
 assert.ok(p.z<-14.5,'crouching cannot pass through parked cars')
 let roof={x:-20,y:0,z:5.2};for(let i=0;i<50;i++)roof=move(roof,{x:0,z:1},TICK_MS,TRAINING_WORLD,CROUCH.height)
 assert.ok(roof.y>4,'crouched ramp traversal reaches roof height')
})
test('parked-car cover blocks a crouched target and stance-aware origins cannot fire through it',()=>{
 const g=game('online'),human=g.actors.get('human')!;g.addHuman('other','OTHER');g.enterHuman('other');const other=g.actors.get('other')!
 Object.assign(human,{x:-3,y:0,z:-16,crouch:0,protectedUntil:0,lastShot:-1000})
 Object.assign(other,{x:-3,y:0,z:-8,crouch:0,protectedUntil:0})
 assert.equal(g.fire(human,0,-Math.atan2(.05,8),true),true);assert.equal(other.health,100-RIFLE.headDamage)
 other.health=100;other.crouch=1;g.elapsed+=200;g.fire(human,0,Math.atan2(.95,8),true);assert.equal(other.health,100)
 human.crouch=1;g.elapsed+=200;g.fire(human,0,0,true);assert.equal(other.health,100)
})
test('Solo incoming hits use lower bot damage, kill at zero, and permit time to reach cover',()=>{
 const g=new TrainingGame('human',180000,()=>.5,'solo');g.start();g.elapsed=5000
 const human=g.actors.get('human')!,bot=g.actors.get('bot-0')!
 for(const [id] of g.actors)if(id!==human.id&&id!==bot.id)g.actors.delete(id)
 Object.assign(human,{x:0,y:0,z:-14,protectedUntil:0});Object.assign(bot,{x:0,y:0,z:-6,yaw:Math.PI,protectedUntil:0})
 run(g,850);assert.equal(human.health,100,'reaction window allows movement before first fire')
 run(g,1200);assert.ok(human.health>40,'first burst is survivable')
 Object.assign(bot,{x:0,y:0,z:-6});Object.assign(human,{x:0,y:0,z:-14});
 const before=human.health;g.elapsed+=200;assert.equal(g.fire(bot,Math.PI,Math.atan2(.5,8),true),true)
 assert.equal(human.health,before-SOLO.botBodyDamage)
 for(let i=0;i<8&&human.health>0;i++){g.elapsed+=200;g.fire(bot,Math.PI,Math.atan2(.5,8),true)}
 assert.equal(human.health,0);assert.equal(human.deaths,1);assert.ok(human.respawnUntil>g.elapsed)
})
