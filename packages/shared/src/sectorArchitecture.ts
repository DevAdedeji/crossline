import type { Building, Solid, WorldGeometry } from './urban-map.js'
import type { Position } from './index.js'

/** Real rooms create flanking routes; every new wall also participates in AI and ballistics. */
export function populateSector(id:string, environment:NonNullable<WorldGeometry['environment']>, variant:number,
  buildings:Building[], solids:Solid[], objectives:Position[], roads:number[]) {
  const center=objectives[3]!
  const styles:NonNullable<Building['architecture']>[]=environment==='industrial'||environment==='airfield'
    ? ['workshop','hall','workshop','clinic'] : environment==='forest'?['house','workshop','house','clinic']:['shop','house','clinic','house']
  const labels={house:'RESIDENCE',shop:'CORNER STORES',workshop:'SERVICE WORKSHOP',hall:'WAREHOUSE',clinic:'MEDICAL STATION',bunker:'GUARD HOUSE'}
  let count=0
  const candidates:number[][]=[]
  // Close pairs of addresses give alleys and courtyards, with a clear central combat space.
  for(const z of [-65,-42,-18,8,34,64])for(const x of [-68,-42,-16,14,40,68])candidates.push([x,z])
  if(variant%2)candidates.reverse()
  for(const [xx,zz] of candidates){
    const x=xx!+(variant%3-1)*2,z=zz!,style=styles[count%styles.length]!
    const width=style==='hall'?18:style==='workshop'?14:12,depth=style==='shop'?10:14
    if(roads.some(r=>Math.abs(x-r)<width/2+6||(environment!=='airfield'&&Math.abs(z-r)<depth/2+6)))continue
    if(Math.abs(x-center.x)<31&&Math.abs(z-center.z)<25)continue
    if(objectives.some(p=>Math.abs(x-p.x)<width/2+8&&Math.abs(z-p.z)<depth/2+8))continue
    if(buildings.some(b=>Math.abs(x-b.x)<(width+b.width)/2+5&&Math.abs(z-b.z)<(depth+b.depth)/2+5))continue
    if(solids.some(s=>Math.abs(x-s.x)<(width+s.width)/2+3&&Math.abs(z-s.z)<(depth+s.depth)/2+3))continue
    buildings.push({id:`${id}-address-${count}`,name:`${labels[style]} / ${String(count+1).padStart(2,'0')}`,x,z,width,depth,
      height:style==='house'?6.6:style==='hall'?6.8:3.8,doorWidth:style==='workshop'||style==='hall'?4:2.8,
      architecture:style,material:count%3===0?'brick':style==='hall'?'metal':'plaster',doors:['south','north']})
    count++
    if(count>=10)break
  }
  for(const b of buildings){
    b.architecture??=environment==='industrial'||environment==='airfield'?'hall':environment==='forest'?'house':environment==='desert'?'bunker':'shop'
    if(b.id.endsWith('-north')&&environment==='airfield')continue
    // Shelving and a partial room divider sit beside the through route, never across it.
    if(b.id.includes('-address-')) {
      solids.push({id:`room-divider-${b.id}`,x:b.x-b.width*.25,y:1.4,z:b.z+2,width:.2,height:2.8,depth:b.depth*.38,material:b.material})
      solids.push({id:`equipment-cabinet-room-${b.id}`,x:b.x+b.width/2-1,y:1,z:b.z+b.depth/2-1.1,width:1.2,height:2,depth:1.2,material:'metal'})
    }
    // Short courtyard walls provide cover without sealing either entrance.
    if(b.architecture==='house'||b.architecture==='clinic')for(const side of [-1,1]){
      solids.push({id:`garden-wall-${b.id}-${side}`,x:b.x+side*(b.width/2+.8),y:.55,z:b.z-b.depth/2-1.5,width:.35,height:1.1,depth:4,material:'brick'})
      solids.push({id:`planter-${b.id}-${side}`,x:b.x+side*(b.width/2-1.2),y:.35,z:b.z-b.depth/2-3,width:1.2,height:.7,depth:1.2,material:'concrete'})
    }
  }
}
