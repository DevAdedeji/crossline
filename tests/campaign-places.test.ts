import test from 'node:test'
import assert from 'node:assert/strict'
import { CAMPAIGN_MISSIONS } from '../packages/shared/src/campaign.js'
import { move, isBlocked, TICK_MS } from '../packages/shared/src/index.js'
import { getNavigation } from '../packages/shared/src/simulation/navigation.js'

// Authored streets must keep buildings separate and every entrance usable, even
// when a mission does not happen to route its companion through that address.
test('campaign neighbourhood entrances stay clear of neighbouring buildings and street furniture', () => {
  const failures:string[]=[]
  for (const mission of CAMPAIGN_MISSIONS.slice(1)) {
    const { world } = mission
    for (const [i,b] of world.buildings.entries()) {
      for (const other of world.buildings.slice(i+1)) {
        if(Math.abs(b.x-other.x)<(b.width+other.width)/2 && Math.abs(b.z-other.z)<(b.depth+other.depth)/2)failures.push(`${mission.id}: ${b.name} overlaps ${other.name}`)
      }
      for (const door of b.doors) {
        const dx=door==='east'?1:door==='west'?-1:0,dz=door==='north'?1:door==='south'?-1:0
        for (const offset of [-1,0,1]) {
          const p={x:b.x+dx*(b.width/2+offset),y:0,z:b.z+dz*(b.depth/2+offset)}
          if(isBlocked(p,world))failures.push(`${mission.id}: ${b.name} ${door} doorway ${offset}`)
        }
      }
    }
  }
  assert.deepEqual(failures,[])
})

test('campaign apartment stairs support slow walking up and down every storey and enemy pursuit', () => {
  for(const mission of CAMPAIGN_MISSIONS) for(const b of mission.world.buildings.filter(b=>b.architecture==='apartment')) {
    const world=mission.world,west=b.x-b.width/2,floors=Math.round((b.height??0)/3.2)
    const entry={x:west+2,y:0,z:b.z-6.7}
    for(const speed of [.2,1]){
      let p={...entry}
      function walk(x:number,z:number,y:number){
        for(let tick=0;tick<2200;tick++){
          const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz)
          if(d<.04)break
          const s=Math.min(speed,d/.2),next=move(p,{x:dx/d*s,z:dz/d*s},TICK_MS,world)
          assert.equal(isBlocked(next,world),false,`${mission.id}: stair penetration`)
          assert.ok(Math.abs(next.y-p.y)<=.241,`${mission.id}: discontinuous riser`)
          p=next
        }
        assert.ok(Math.hypot(x-p.x,z-p.z)<.05&&Math.abs(p.y-y)<.01,`${mission.id} ${b.name}: ${JSON.stringify({p,x,z,y,speed})}`)
      }
      for(let floor=0;floor<floors;floor++){
        walk(west+(floor%2===0?2:5),p.z,floor*3.2)
        walk(p.x,b.z+(floor%2===0?6.7:-6.7),(floor+1)*3.2)
      }
      for(let floor=floors-1;floor>=0;floor--){
        walk(west+(floor%2===0?2:5),p.z,(floor+1)*3.2)
        walk(p.x,b.z+(floor%2===0?-6.7:6.7),floor*3.2)
      }
    }
    assert.ok(getNavigation(world).findPath(entry,{x:west+(floors%2===1?2:5),y:floors*3.2,z:b.z+(floors%2===1?6.7:-6.7)}).length,`${mission.id}: enemies cannot follow upstairs`)
  }
})
