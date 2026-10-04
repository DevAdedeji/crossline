import type { Building, Solid, WorldGeometry } from './urban-map.js'

/** Purpose-built campaign layouts; all playable cover is shared with collision and AI. */
function arena(id: string, name: string, limit: number, buildings: Building[], solids: Solid[], roads: number[]): WorldGeometry {
  const box = (id:string,x:number,y:number,z:number,width:number,height:number,depth:number,material:Solid['material']) => solids.push({id,x,y,z,width,height,depth,material})
  for (const b of buildings) {
    for (const side of ['north','south','east','west'] as const) {
      const horizontal=side==='north'||side==='south', sign=side==='north'||side==='east'?1:-1
      const length=horizontal?b.width:b.depth, x=b.x+(horizontal?0:sign*b.width/2),z=b.z+(horizontal?sign*b.depth/2:0)
      if(b.doors.includes(side)) {
        const segment=(length-3)/2
        for(const direction of [-1,1]) { const offset=direction*(1.5+segment/2);box(`${b.id}-${side}-${direction}`,x+(horizontal?offset:0),1.9,z+(horizontal?0:offset),horizontal?segment:.4,3.8,horizontal?.4:segment,b.material) }
        box(`${b.id}-${side}-lintel`,x,3.4,z,horizontal?3:.4,.8,horizontal?.4:3,b.material)
      } else box(`${b.id}-${side}`,x,1.9,z,horizontal?length:.4,3.8,horizontal?.4:length,b.material)
    }
    box(`${b.id}-roof`,b.x,3.95,b.z,b.width+.6,.3,b.depth+.6,'roof')
  }
  for(const [x,z,w,d] of [[0,limit+1,limit*2+2,.5],[0,-limit-1,limit*2+2,.5],[-limit-1,0,.5,limit*2],[limit+1,0,.5,limit*2]])box(`boundary-${x}-${z}`,x!,1.5,z!,w!,3,d!,'concrete')
  return {id,name,limit,buildings,solids,cars:[],roadCenters:roads,colliders:solids,legacyRamp:false,
    navigationPoints:buildings.flatMap(b=>b.doors.flatMap(side=>{const dx=side==='east'?1:side==='west'?-1:0,dz=side==='north'?1:side==='south'?-1:0;return [2,-2].map(offset=>({x:b.x+dx*(b.width/2+offset),y:0,z:b.z+dz*(b.depth/2+offset)}))}))}
}
const portSolids:Solid[]=[]
for(const x of [-60,-38,28,50])for(const z of [-48,-24,4,30]) {
  portSolids.push({id:`container-${x}-${z}`,x,y:1.6,z,width:8,height:3.2,depth:12,material:'metal'})
  for(const side of [-1,1])for(let rib=-5;rib<=5;rib+=2)portSolids.push({id:`container-rib-${x}-${z}-${side}-${rib}`,x:x+side*4,y:1.6,z:z+rib,width:.12,height:3.2,depth:.1,material:'metal'})
}
for(const x of [-64,60]) {
  for(const dx of [-8,8])portSolids.push({id:`crane-leg-${x}-${dx}`,x:x+dx,y:8,z:70,width:1,height:16,depth:1,material:'metal'})
  portSolids.push({id:`crane-beam-${x}`,x,y:16,z:70,width:22,height:1.2,depth:2,material:'metal'})
}
for(const [id,x,z] of [['manifest-terminal',0,-21],['shipment-core',62,51]] as const)portSolids.push({id,x,y:.8,z,width:2,height:1.6,depth:1,material:'metal'})
export const FREIGHT_PORT = arena('freight-port','NORTH QUAY',96,[
  {id:'port-customs',name:'NORTH QUAY / CUSTOMS',x:0,z:-20,width:16,depth:14,material:'concrete',doors:['south','north']},
  {id:'port-armoury',name:'RESTRICTED / FREIGHT 07',x:62,z:50,width:18,depth:16,material:'metal',doors:['south','west']},
  {id:'port-store',name:'QUAY / STORAGE',x:-56,z:55,width:18,depth:12,material:'brick',doors:['south','east']},
],portSolids,[-82,0,82])

const villageSolids:Solid[]=[]
for(const [x,z] of [[-20,-50],[18,-40],[-46,0],[46,12],[-10,26],[26,50],[-50,48],[48,-42]]) {
  villageSolids.push({id:`garden-wall-${x}-${z}`,x:x!,y:.6,z:z!,width:7,height:1.2,depth:.6,material:'brick'})
  villageSolids.push({id:`planter-${x}-${z}`,x:x!+5,y:.4,z:z!+3,width:2.2,height:.8,depth:2.2,material:'concrete'})
}
villageSolids.push({id:'village-radio',x:-48,y:.8,z:23,width:1.2,height:1.6,depth:.5,material:'metal'})
export const HILL_VILLAGE = arena('hill-village','KITE RIDGE',78,[
  {id:'ridge-radio',name:'KITE RIDGE / WATCH POST',x:-48,z:22,width:12,depth:10,material:'brick',doors:['south','east']},
  {id:'ridge-clinic',name:'KITE RIDGE / FIELD CLINIC',x:40,z:44,width:16,depth:12,material:'plaster',doors:['south','west']},
  {id:'ridge-home-a',name:'RIDGE / COURTYARD',x:-28,z:-28,width:10,depth:12,material:'plaster',doors:['east','north']},
  {id:'ridge-home-b',name:'RIDGE / HOMESTEAD',x:34,z:-20,width:14,depth:10,material:'brick',doors:['west','south']},
  {id:'ridge-market',name:'RIDGE / MARKET',x:4,z:10,width:12,depth:10,material:'wood',doors:['south','north','west']},
  {id:'ridge-school',name:'RIDGE / SCHOOL',x:-22,z:52,width:16,depth:10,material:'plaster',doors:['south','east']},
  {id:'ridge-barn',name:'RIDGE / FARM STORE',x:46,z:-52,width:12,depth:12,material:'wood',doors:['west','north']},
],villageSolids,[])
