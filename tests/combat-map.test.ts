import test from 'node:test'
import assert from 'node:assert/strict'
import { COMBAT_WORLD, COMBAT_DISTRICTS, COMBAT_SPAWNS, TRAINING_WORLD, move, isBlocked, TICK_MS } from '../packages/shared/src/index.js'
import { worldHit } from '../packages/shared/src/combat.js'
import { getNavigation } from '../apps/match/src/training/navigation.js'
import { TrainingGame } from '../apps/match/src/training/TrainingGame.js'

test('combat map is nine times Training area, with distinct districts and safe distributed spawns', () => {
  assert.equal(COMBAT_WORLD.limit*2,156)
  assert.equal((COMBAT_WORLD.limit/TRAINING_WORLD.limit)**2,9)
  assert.equal(COMBAT_DISTRICTS.length,9)
  assert.ok(COMBAT_WORLD.buildings.length>=12)
  assert.ok(COMBAT_SPAWNS.every(p=>!isBlocked(p,COMBAT_WORLD)))
  assert.ok(COMBAT_DISTRICTS.every(d=>COMBAT_SPAWNS.some(p=>Math.hypot(p.x-d.x,p.z-d.z)<25)))
  let point={x:0,y:0,z:24}
  for(let i=0;i<240;i++)point=move(point,{x:0,z:1},TICK_MS,COMBAT_WORLD)
  assert.ok(point.z>60)
  assert.ok(move({x:0,y:0,z:26},{x:0,z:1},TICK_MS).z<=26)
  assert.ok(worldHit({x:-60,y:1.6,z:50},{x:0,y:0,z:1},80,COMBAT_WORLD)<10)
})
test('navigation connects all districts through collision-checked routes', async () => {
  const nav=getNavigation(COMBAT_WORLD),start={x:0,y:0,z:-21}
  await nav.precompute()
  for(const district of COMBAT_DISTRICTS) {
    const destination={x:district.x,y:0,z:district.z-21}
    const path=nav.findPath(start,destination)
    assert.ok(path.length>0)
    assert.ok(Math.hypot(path.at(-1)!.x-destination.x,path.at(-1)!.z-destination.z)<7, district.name)
    for(let i=1;i<path.length;i++)assert.ok(nav.canWalk(path[i-1]!,path[i]!),district.name)
  }
})
test('large Solo simulations stay bounded and target only humans across full matches', async () => {
 await getNavigation(COMBAT_WORLD).precompute()
 for(const initialSeed of [11,41,124]) {
  let seed=initialSeed
  const game=new TrainingGame('human',180000,()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296},'solo')
  assert.equal(game.actors.size,13);game.start()
  let shots=0,kills=0,maxStep=0
  for(let i=0;i<5401;i++) {
    const start=performance.now();game.step();maxStep=Math.max(maxStep,performance.now()-start)
    for(const event of game.drainEvents()) {
      if(event.type==='shot')shots++
      if(event.type==='kill')kills++
      if(event.type==='damage')assert.equal(game.actors.get(event.targetId)!.bot,false)
    }
    for(const memory of game['memories'].values()) {
      if(memory.targetId)assert.equal(game.actors.get(memory.targetId)!.bot,false)
      if(memory.lastSeenId)assert.equal(game.actors.get(memory.lastSeenId)!.bot,false)
    }
    for(const actor of game.actors.values()) {
      assert.ok([actor.x,actor.y,actor.z,actor.yaw].every(Number.isFinite))
      assert.ok(Math.abs(actor.x)<=78&&Math.abs(actor.z)<=78)
      if(actor.bot){assert.equal(actor.health,100);assert.equal(actor.deaths,0)}
    }
  }
  assert.equal(game.phase,'finished');assert.ok(shots>10);assert.ok(kills>0)
  console.log(JSON.stringify({seed:initialSeed,largeMapShots:shots,kills,maxStepMs:Math.round(maxStep*100)/100}))
 }
})

test('long-range Solo shots use combat-map cover rather than the Training boundary', () => {
  const game=new TrainingGame('human',180000,()=>.5,'solo')
  const human=game.actors.get('human')!,bot=game.actors.get('bot-0')!
  game.actors.clear();game.actors.set(human.id,human);game.actors.set(bot.id,bot)
  Object.assign(human,{x:0,y:0,z:-72,protectedUntil:0})
  Object.assign(bot,{x:0,y:0,z:2,protectedUntil:0})
  game.start();game.elapsed=2000
  assert.equal(game.fire(human,0,Math.atan2(.5,74),true),true)
  assert.equal(bot.health,75)
  const shot=game.drainEvents().find(event=>event.type==='shot')!
  assert.equal(shot.type,'shot');if(shot.type==='shot')assert.ok(shot.end.z-shot.start.z>73)
})
