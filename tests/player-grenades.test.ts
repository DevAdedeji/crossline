import test from 'node:test'
import assert from 'node:assert/strict'
import { TrainingGame } from '../packages/shared/src/simulation/TrainingGame.js'
import { stepPlayerGrenade, type PlayerGrenade } from '../packages/shared/src/campaignGrenades.js'
import { TICK_MS, type WorldGeometry } from '../packages/shared/src/index.js'
const world:WorldGeometry={id:'grenade-test',name:'TEST',limit:50,buildings:[],cars:[],solids:[],colliders:[],roadCenters:[],legacyRamp:false}
function game(mode:'training'|'online'='training'){return new TrainingGame('human',60000,()=>.5,mode,{world,spawns:[{x:0,y:0,z:0},{x:20,y:0,z:20}],botCount:0,healthPacks:[],respawn:true})}
function run(g:TrainingGame,ms:number){for(let n=0;n<Math.ceil(ms/TICK_MS);n++)g.step()}
function grenade(overrides:Partial<PlayerGrenade>={}):PlayerGrenade{return{id:'test',sourceId:'human',x:0,y:.12,z:0,vx:0,vy:0,vz:0,remainingMs:1,...overrides}}
test('Player grenades are limited per life, rate limited and frozen while paused',()=>{
  const g=game(),player=g.actors.get('human')!
  assert.equal(g.throwGrenade('human'),false);g.start();assert.equal(g.throwGrenade('forged'),false)
  assert.equal(g.throwGrenade('human'),true);assert.equal(player.grenades,1);assert.equal(player.protectedUntil,0)
  assert.equal(g.throwGrenade('human'),false)
  g.pause();const fuse=[...g.grenades.values()][0]!.remainingMs;run(g,4000)
  assert.equal([...g.grenades.values()][0]!.remainingMs,fuse);assert.equal(g.throwGrenade('human'),false)
  g.start();run(g,1100);assert.equal(g.throwGrenade('human'),true);assert.equal(player.grenades,0)
  run(g,1100);assert.equal(g.throwGrenade('human'),false)
  player.health=0;player.respawnUntil=g.elapsed+1;run(g,100);assert.equal(player.grenades,2)
  g.finish();g.restart();assert.equal(g.grenades.size,0)
})
test('Throws bounce off thin walls, ceilings and the ground without tunneling',()=>{
  const wall={id:'wall',x:1,y:2,z:0,width:.2,height:4,depth:8,material:'concrete' as const}
  const g=grenade({y:1,vx:40,remainingMs:2600})
  stepPlayerGrenade(g,{...world,colliders:[wall]},100)
  assert.ok(g.x<.9);assert.ok(g.vx<0)
  const ceiling={...wall,x:0,y:2,width:8,height:.2}
  const up=grenade({y:1,vy:20});stepPlayerGrenade(up,{...world,colliders:[ceiling]},100)
  assert.ok(up.y<1.9);assert.ok(up.vy<0)
  const falling=grenade({y:1,vy:-20});stepPlayerGrenade(falling,world,100)
  assert.ok(falling.y>=.119);assert.ok(falling.vy>0)
})
test('A blast respects cover and protection, awards one kill, and never improves rifle accuracy',()=>{
  const g=game('online');g.addHuman('human','Human');g.enterHuman('human');g.addHuman('victim','Victim');g.enterHuman('victim');g.addHuman('protected','Protected');g.enterHuman('protected');g.start()
  const source=g.actors.get('human')!,victim=g.actors.get('victim')!,protectedPlayer=g.actors.get('protected')!
  Object.assign(source,{x:20,z:20});Object.assign(victim,{x:0,z:0,protectedUntil:0});Object.assign(protectedPlayer,{x:0,z:0,protectedUntil:10000})
  g.grenades.set('test',grenade());g.step()
  assert.equal(victim.health,0);assert.equal(victim.deaths,1);assert.equal(source.kills,1);assert.equal(source.score,100)
  assert.equal(source.shots,0);assert.equal(source.hits,0);assert.equal(protectedPlayer.health,100)
  assert.equal(g.drainEvents().filter(e=>e.type==='kill').length,1);g.step();assert.equal(g.drainEvents().filter(e=>e.type==='kill').length,0)
})
test('Own grenades count a death without a kill, and inactive or disconnected players cannot throw',()=>{
  const g=game(),p=g.actors.get('human')!;g.start();Object.assign(p,{x:0,z:0,protectedUntil:0})
  p.connected=false;assert.equal(g.throwGrenade(p.id),false);p.connected=true
  p.participating=false;assert.equal(g.throwGrenade(p.id),false);p.participating=true
  g.grenades.set('test',grenade());g.step()
  assert.equal(p.health,0);assert.equal(p.deaths,1);assert.equal(p.kills,0);assert.equal(p.score,0);assert.equal(g.throwGrenade(p.id),false)
  const event=g.drainEvents().find(e=>e.type==='kill');assert.equal(event?.humanKill,false)
})
