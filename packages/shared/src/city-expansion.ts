import type { Building, Solid } from './urban-map.ts'

/** Metres, shared verbatim by authoritative collision, bot routes and rendering. */
const names = ['ARCHIVE QUARTER','WEST MARKET','RIVERSIDE HOMES','WEST TRANSIT','CANAL WORKS','SOUTH FREIGHT','NORTH TRANSIT','SOUTH GARDENS','NORTH HOUSING','SOUTH EXCHANGE','NORTH OFFICES','EAST LOGISTICS','POWER STATION','EAST MARKET','CIVIC HEIGHTS','CIVIC GARDENS']
export const COMBAT_ROAD_CENTERS = [-224,-168,-112,-48,0,48,112,168,224]
const existing = [-112,-48,0,48,112].flatMap(x=>[-112,-48,0,48,112].filter(z=>Math.abs(x)===112||Math.abs(z)===112).map(z=>({x,z,name:''}))).map((d,i)=>({...d,name:names[i]!}))
// Keep existing district IDs and landmarks stable as the city grows outwards.
const outer = COMBAT_ROAD_CENTERS.flatMap(x=>COMBAT_ROAD_CENTERS
 .filter(z=>Math.abs(x)>112||Math.abs(z)>112)
 .map(z=>({x,z,name:`${z<0?'SOUTH':z>0?'NORTH':'CENTRAL'} ${x<0?'WEST':x>0?'EAST':'MERCER'} / ${Math.abs(x)}-${Math.abs(z)}`})))
export const CITY_DISTRICTS = [...existing,...outer]
export const CITY_BUILDINGS: Building[]=[]
export const CITY_SOLIDS: Solid[]=[]
export const CITY_NAV: {x:number;y:number;z:number}[]=[]
export const CITY_ROOFS: {x:number;y:number;z:number}[]=[]
function box(id:string,x:number,y:number,z:number,width:number,height:number,depth:number,material:Solid['material']){CITY_SOLIDS.push({id,x,y,z,width,height,depth,material})}
for(const [i,d] of CITY_DISTRICTS.entries())for(const wing of [0,1]) {
 const x=d.x+(wing===0?-18:18),z=d.z+(wing===0?18:-18),id=`city-${i}-${wing}`
 // Low-rise outer blocks add playable streets without multiplying tower interiors.
 const floors=i>=existing.length||wing===1?1:i===14?6:i===0?4:2+i%2,material=i%3===0?'brick':'plaster'
 CITY_BUILDINGS.push({id,name:`${d.name} / ${wing===0?'HALL':'SUPPLY'}`,x,z,width:18,depth:16,height:floors*3.2,material,doors:['north','south']})
 for(let f=0;f<floors;f++) {
  const y=f*3.2
  for(const side of [-1,1]) {
   box(`${id}-wall-x-${f}-${side}`,x+side*9,y+1.6,z,.4,3.2,16,material)
   // Full-height upper walls; two ground entrances keep the hall a through-route.
   if(f===0){
    for(const dir of [-1,1])box(`${id}-door-${side}-${dir}`,x+dir*5.25,y+1.6,z+side*8,7.5,3.2,.4,material)
    box(`${id}-lintel-${side}`,x,y+2.9,z+side*8,3,.6,.4,material)
   }else box(`${id}-wall-z-${f}-${side}`,x,y+1.6,z+side*8,18,3.2,.4,material)
  }
  // Open stairwell in the west wing. Alternating 20cm risers join broad end landings.
  const lane=f%2===0?-6:-3,dir=f%2===0?1:-1
  for(let step=1;step<=16;step++) {
   const h=step*.2
   box(`${id}-stair-${f}-${step}`,x+lane,y+h/2,z+dir*(-6+(step-.5)*.75),2.4,h,.75,'concrete')
  }
  const top=y+3.2
  box(`${id}-floor-${f}`,x+4.5,top-.15,z,9,.3,16,'roof')
  for(const side of [-1,1])box(`${id}-landing-${f}-${side}`,x-4.5,top-.15,z+side*7,9,.3,2,'roof')
  // Desks and supply stacks leave the east hall and cross-landings navigable.
  box(`${id}-desk-${f}`,x+6,y+.55,z-2,2,1.1,1.4,'wood')
  box(`${id}-locker-${f}`,x+7,y+.9,z+3,1,1.8,2,'metal')
 }
 for(let f=0;f<=floors;f++) {
  const y=f*3.2
  for(const dx of [-6,-3,2.5])for(const dz of [-6.7,6.7])CITY_NAV.push({x:x+dx,y,z:z+dz})
  CITY_NAV.push({x:x+2.5,y,z})
  if(f===0)for(const side of [-1,1])CITY_NAV.push({x,y,z:z+side*10},{x,y,z:z+side*6.7})
 }
 for(const side of [-1,1]){
  box(`${id}-parapet-x-${side}`,x+side*9,floors*3.2+.4,z,.3,.8,16,material)
  box(`${id}-parapet-z-${side}`,x,floors*3.2+.4,z+side*8,18,.8,.3,material)
 }
 CITY_ROOFS.push({x:x+2.5,y:floors*3.2,z})
}
