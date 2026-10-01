import { BUILDINGS, MAP_SOLIDS, PARKED_CARS, type Building, type Solid, type ParkedCar, type WorldGeometry } from './urban-map.ts'

export const COMBAT_BOT_COUNT = 12
export const COMBAT_DISTRICTS = [
  { name: 'MERCER CENTRE', x: 0, z: 0 },
  { name: 'OLD QUARTER', x: -48, z: 48 },
  { name: 'FOUNDRY', x: 48, z: 48 },
  { name: 'MARKET ROW', x: -48, z: -48 },
  { name: 'FREIGHT YARD', x: 48, z: -48 },
  { name: 'NORTH TERMINAL', x: 0, z: 48 },
  { name: 'SOUTH MOTOR COURT', x: 0, z: -48 },
  { name: 'WEST DEPOT', x: -48, z: 0 },
  { name: 'EAST WORKS', x: 48, z: 0 },
] as const
const buildings: Building[] = [...BUILDINGS]
const solids: Solid[] = MAP_SOLIDS.filter(s => !s.id.startsWith('boundary-'))
const cars: ParkedCar[] = [...PARKED_CARS]
function box(id: string, x: number, z: number, width: number, depth: number, height: number, material: Solid['material'], y=height/2) {
  solids.push({id,x,y,z,width,depth,height,material})
}
function building(id: string, name: string, x: number, z: number, material: Solid['material']) {
  const b: Building = {id,name,x,z,width:12,depth:10,material,doors:['east','north']}
  buildings.push(b)
  for(const side of ['north','south','east','west'] as const) {
    const horizontal=side==='north'||side==='south', length=horizontal?b.width:b.depth
    const sign=side==='north'||side==='east'?1:-1
    const xx=x+(horizontal?0:sign*b.width/2), zz=z+(horizontal?sign*b.depth/2:0)
    if(b.doors.includes(side)) {
      const segment=(length-2.4)/2
      for(const direction of [-1,1]) {
        const offset=direction*(1.2+segment/2)
        box(`${id}-${side}-${direction}`,xx+(horizontal?offset:0),zz+(horizontal?0:offset),horizontal?segment:.4,horizontal?.4:segment,3.8,material)
      }
      box(`${id}-${side}-lintel`,xx,zz,horizontal?2.4:.4,horizontal?.4:2.4,1.2,material,3.2)
    } else box(`${id}-${side}`,xx,zz,horizontal?length:.4,horizontal?.4:length,3.8,material)
  }
  box(`${id}-roof`,x,z,12.6,10.6,.3,'roof',3.95)
}
// Distinct outer districts: shops, industrial buildings, loading lots and staggered street cover.
for(const [i,d] of COMBAT_DISTRICTS.entries()) {
  if(i===0)continue
  const industrial=[2,4,7,8].includes(i)
  building(`district-${i}-a`,`${d.name} / ${industrial?'WORKSHOP':'SUPPLY'}`,d.x-12,d.z+12,industrial?'brick':'plaster')
  if(i<=4)building(`district-${i}-b`,`${d.name} / ${industrial?'STORES':'ARCADE'}`,d.x+13,d.z-12,industrial?'metal':'concrete')
  cars.push({id:`district-${i}-car-a`,x:d.x-3,z:d.z-12,sideways:false,color:'#7e8887'})
  cars.push({id:`district-${i}-car-b`,x:d.x+14,z:d.z+2,sideways:true,color:'#7e8887'})
  const rows=industrial?3:2
  for(let row=0;row<rows;row++) {
    box(`district-${i}-cover-${row}`,d.x+11+row*3.4,d.z+13,industrial?2.6:2.2,industrial?5:1.4,industrial?2.5:1.1,industrial?'metal':'concrete')
    box(`district-${i}-pallet-${row}`,d.x-12+row*3.4,d.z-12,1.5,1.5,1.25,'wood')
  }
  // Mid-block cover breaks up the long lanes without sealing their walking routes.
  box(`district-${i}-street-cover`,d.x+2,d.z+23,2.1,1.2,1.1,'concrete')
}
for(const [x,z,w,d] of [[0,78.6,157.2,.4],[0,-78.6,157.2,.4],[-78.6,0,.4,157.2],[78.6,0,.4,157.2]])
  box(`combat-boundary-${x}-${z}`,x!,z!,w!,d!,2.4,'concrete')
export const COMBAT_WORLD: WorldGeometry = {
  id:'mercer-districts',name:'MERCER DISTRICTS',limit:78,buildings,solids,cars,roadCenters:[-48,0,48],
  colliders:[...solids,...cars.map(car=>({id:car.id,x:car.x,y:.78,z:car.z,width:car.sideways?4.5:2,height:1.56,depth:car.sideways?2:4.5,material:'metal' as const}))],
}
const spawnCandidates = [
  {x:0,y:0,z:-21},{x:-1,y:0,z:-5},{x:3,y:0,z:7},{x:-12,y:0,z:11},{x:13,y:0,z:12},{x:-12,y:4.1,z:11},
  ...COMBAT_DISTRICTS.slice(1).map(d=>({x:d.x,y:0,z:d.z-21})),
  ...COMBAT_DISTRICTS.flatMap(d=>[{x:d.x,y:0,z:d.z-21},{x:d.x+3,y:0,z:d.z+19},{x:d.x-21,y:0,z:d.z-3}]),
]

export const COMBAT_SPAWNS = [...new Map(spawnCandidates.map(p=>[`${p.x}/${p.y}/${p.z}`,p])).values()]
