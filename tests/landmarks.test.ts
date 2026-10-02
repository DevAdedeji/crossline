import test from 'node:test'
import assert from 'node:assert/strict'
import { move,TICK_MS } from '../packages/shared/src/index.js'
import { COMBAT_WORLD, LANDMARK_BUILDINGS, LANDMARK_SPAWNS, isBlocked } from '../packages/shared/src/index.js'
import { worldHit } from '../packages/shared/src/combat.js'
import { getNavigation } from '../apps/match/src/training/navigation.js'
test('factory hall and four-storey tower have accessible interiors and real high roofs',async()=>{
 const nav=getNavigation(COMBAT_WORLD);await nav.precompute()
 assert.equal(LANDMARK_BUILDINGS.find(b=>b.id==='ironworks')!.height,8)
 assert.equal(LANDMARK_BUILDINGS.find(b=>b.id==='foundry-tower')!.height,12.8)
 assert.ok(nav.canWalk({x:0,y:0,z:33},{x:0,y:0,z:40}),'factory loading bay is open')
 assert.ok(nav.canWalk({x:48,y:0,z:37},{x:48,y:0,z:44}),'tower ground entrance is open')
 for(const goal of LANDMARK_SPAWNS){
  assert.equal(isBlocked(goal,COMBAT_WORLD),false)
  const start={x:0,y:0,z:-21},path=nav.findPath(start,goal)
  assert.ok(nav.canWalk(path.at(-1)!,goal),`route reaches ${JSON.stringify(goal)}; ended ${JSON.stringify(path.at(-1))}`)
  assert.ok(nav.canWalk(start,path[0]!))
  for(let i=1;i<path.length;i++)assert.ok(nav.canWalk(path[i-1]!,path[i]!),`walkable stair segment ${i}`)
 }
})
test('landmark factory roof and tower floors occlude shots, while loading bay admits rays',()=>{
 assert.ok(worldHit({x:0,y:1.6,z:32},{x:0,y:0,z:1},10,COMBAT_WORLD)>9)
 assert.ok(worldHit({x:10,y:1.6,z:32},{x:0,y:0,z:1},10,COMBAT_WORLD)<3)
 assert.ok(worldHit({x:0,y:1.6,z:42},{x:0,y:1,z:0},20,COMBAT_WORLD)>5)
 assert.ok(worldHit({x:48,y:1.6,z:48},{x:0,y:1,z:0},20,COMBAT_WORLD)<1.5)
 assert.ok(worldHit({x:48,y:4.8,z:48},{x:0,y:1,z:0},20,COMBAT_WORLD)<1.5)
})

test('tower landing admits slow analog stair movement without a double-height lip',()=>{
 for(const speed of [.2,.4,1]) {
  let p={x:60.5,y:3.2,z:56}
  for(let i=0;i<1200 && p.z>38.7;i++)p=move(p,{x:0,z:-speed},TICK_MS,COMBAT_WORLD)
  assert.ok(p.z<39,JSON.stringify({speed,p}));assert.ok(Math.abs(p.y-6.4)<.01)
 }
})
