import test from 'node:test'
import assert from 'node:assert/strict'
import { COMBAT_WORLD, move, isBlocked, TICK_MS } from '../packages/shared/src/index.ts'
import { CITY_BUILDINGS } from '../packages/shared/src/city-expansion.ts'
import { solidTopSurfaces } from '../apps/web/app/game/solidSurfaces.ts'
import { StairCamera } from '../apps/web/app/game/stairCamera.ts'

test('six-storey city stairs ascend and descend at walking and analog speeds without penetration', () => {
  const building=CITY_BUILDINGS.find(b=>(b.height ?? 0)>19)!
  for (const speed of [.2,.5,1]) for (const offset of [-.65,0,.65]) {
    let p={x:building.x-6+offset,y:0,z:building.z-6.7}
    function walk(x:number,z:number,y:number) {
      for(let tick=0;tick<2200;tick++) {
        const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz)
        if(d<.04)break
        const s=Math.min(speed,d/.2)
        const next=move(p,{x:dx/d*s,z:dz/d*s},TICK_MS,COMBAT_WORLD)
        assert.equal(isBlocked(next,COMBAT_WORLD),false)
        assert.ok(Math.abs(next.y-p.y)<=.241,'each step stays within a single riser')
        p=next
      }
      assert.ok(Math.hypot(x-p.x,z-p.z)<.05,JSON.stringify({p,x,z,speed,offset}))
      assert.ok(Math.abs(p.y-y)<.01,JSON.stringify({p,y,speed,offset}))
    }
    for(let floor=0;floor<6;floor++) {
      const lane=building.x+(floor%2===0?-6:-3)+offset,end=building.z+(floor%2===0?6.7:-6.7)
      walk(lane,p.z,floor*3.2);walk(lane,end,(floor+1)*3.2)
    }
    for(let floor=5;floor>=0;floor--) {
      const lane=building.x+(floor%2===0?-6:-3)+offset,end=building.z+(floor%2===0?-6.7:6.7)
      walk(lane,p.z,(floor+1)*3.2);walk(lane,end,floor*3.2)
    }
  }
})

test('overlapping stair and landing tops render once while preserving their union', () => {
  const solids=COMBAT_WORLD.solids.filter(s=>s.id.startsWith('landmark-tower-') || s.id.startsWith('landmark-hospital-'))
  const faces=solidTopSurfaces(solids)
  let removed=0
  for(const solid of solids) {
    const pieces=faces.get(solid.id)!
    const area=pieces.reduce((sum,r)=>sum+(r.right-r.left)*(r.far-r.near),0)
    removed+=solid.width*solid.depth-area
    for(const other of solids) {
      if(other.id===solid.id || Math.abs(other.y+other.height/2-solid.y-solid.height/2)>.00001)continue
      for(const a of pieces)for(const b of faces.get(other.id)!)
        assert.ok(Math.min(a.right,b.right)-Math.max(a.left,b.left)<1e-6 || Math.min(a.far,b.far)-Math.max(a.near,b.near)<1e-6,'no duplicate top surface')
    }
    for(const x of [solid.x-.2,solid.x,solid.x+.2]) for(const z of [solid.z-.2,solid.z,solid.z+.2]) {
      if(Math.abs(x-solid.x)>solid.width/2 || Math.abs(z-solid.z)>solid.depth/2)continue
      assert.ok(solids.filter(s=>Math.abs(s.y+s.height/2-solid.y-solid.height/2)<.00001)
        .some(s=>faces.get(s.id)!.some(r=>x>=r.left-1e-6 && x<=r.right+1e-6 && z>=r.near-1e-6 && z<=r.far+1e-6)),'clipping leaves no holes')
    }
  }
  assert.ok(removed>1,'fixture covers overlapping landing surfaces')
})

test('stair camera smooths risers, settles, and snaps on respawn', () => {
  const camera=new StairCamera()
  assert.equal(camera.update(1.6,1/60),1.6)
  const first=camera.update(1.8,1/60)
  assert.ok(first>1.6 && first<1.7)
  let settled=first
  for(let i=0;i<30;i++)settled=camera.update(1.8,1/60)
  assert.ok(Math.abs(settled-1.8)<.001)
  assert.equal(camera.update(14.4,1/60),14.4)
  camera.reset();assert.equal(camera.update(1.6,1/60),1.6)
})
