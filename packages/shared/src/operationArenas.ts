import { populateSector } from './sectorArchitecture.js'
import { createCampaignArena } from './campaignArenas.js'
import type { Position } from './index.js'
import type { Building, Solid, WorldGeometry } from './urban-map.js'
export type OperationLocation = 'insertion' | 'south' | 'west' | 'center' | 'east' | 'north' | 'exit'
export type OperationEnvironment = NonNullable<WorldGeometry['environment']>
export interface OperationArena {
  world: WorldGeometry
  points: Record<OperationLocation, Position>
  guards: Position[]
}
const layouts = [
  [[-60,-64],[-26,-40],[-50,6],[0,0],[48,12],[8,54],[58,-60]],
  [[60,-66],[24,-38],[-46,-2],[0,22],[48,-8],[-12,58],[-60,-56]],
  [[-62,62],[-10,-46],[-52,22],[2,-4],[50,28],[8,58],[58,-62]],
  [[62,62],[28,-44],[-48,8],[0,-8],[46,24],[-16,56],[-60,-62]],
  [[0,-70],[-32,-36],[-52,18],[8,0],[48,-14],[18,54],[-62,60]],
] as const
export function operationArena(id: string, name: string, environment: OperationEnvironment, variant: number): OperationArena {
  const layout=layouts[variant%layouts.length]!,names:OperationLocation[]=['insertion','south','west','center','east','north','exit']
  const points=Object.fromEntries(names.map((name,i)=>[name,{x:layout[i]![0]+((variant*3+i*2)%7-3),y:0,z:layout[i]![1]+((variant*5+i)%9-4)}])) as Record<OperationLocation,Position>
  const buildings:Building[]=[],solids:Solid[]=[]
  const box=(id:string,x:number,y:number,z:number,width:number,height:number,depth:number,material:Solid['material'])=>solids.push({id,x,y,z,width,height,depth,material})
  for(const [i,location] of (['west','east','north'] as const).entries()){
    const point=points[location]
    const tower=environment==='airfield'&&location==='north'
    buildings.push({id:`${id}-${location}`,name:`${name} / ${tower?'CONTROL TOWER':environment==='airfield'?`HANGAR 0${i+1}`:environment==='industrial'?['PRODUCTION HALL','MACHINE SHOP','CONTROL ROOM'][i]:['CONTROL','OPERATIONS','COMMAND'][i]}`,x:point.x,z:point.z,width:tower?8:environment==='airfield'?26:environment==='urban'?18:environment==='industrial'?24:12,depth:tower?8:environment==='airfield'?24:environment==='industrial'?18:environment==='urban'?16:12,height:tower?12:environment==='airfield'?8:environment==='industrial'?8.2:environment==='urban'?6:3.8,doorWidth:tower?3:environment==='airfield'?14:environment==='industrial'?6:3,material:environment==='industrial'||environment==='airfield'?'metal':i%2?'brick':'plaster',doors:['north','south','east','west']})
  }

  for(const building of buildings.filter(b=>!(environment==='airfield'&&b.id.endsWith('-north'))))for(const side of [-1,1]) {
    box(`sector-storage-${building.id}-${side}`,building.x+side*(building.width/2-1.2),1,building.z+building.depth/2-2,1.4,2,2.2,environment==='forest'||environment==='desert'?'wood':'metal')
  }
  if(environment==='industrial')for(const building of buildings){
    const bx=building.x,bz=building.z
    for(const side of [-1,1]){
      box(`factory-machine-${building.id}-${side}`,bx+side*7,1.1,bz,3,2.2,4,'metal')
      box(`factory-conveyor-${building.id}-${side}`,bx+side*7,.6,bz-4,2,1.2,3,'metal')
      box(`factory-stack-${building.id}-${side}`,bx+side*8,11,bz+5,1.4,6,1.4,'brick')
    }
  }
  if(environment==='airfield'){
    const tower=buildings.find(b=>b.id.endsWith('-north'))!
    box('tower-observation-cabin',tower.x,13.7,tower.z,13,3.4,11,'metal')
    box('tower-observation-roof',tower.x,15.6,tower.z,14,.4,12,'roof')
    box('tower-antenna',tower.x,18,tower.z,.2,4.4,.2,'metal')
  }
  const c=points.center
  if(environment==='industrial' && id==='blackout')for(const side of [-1,1]){
    box(`transformer-${side}`,c.x+side*10,1.7,c.z,4,3.4,8,'metal')
    box(`gantry-${side}`,c.x+side*12,6,c.z+5,.8,12,.8,'metal')
    box(`gantry-arm-${side}`,c.x+side*12,12,c.z+5,10,.7,1,'metal')
  }
  if(environment==='coastal' && id!=='cold-water' && id!=='white-flag')for(const side of [-1,1]){
    box(`crane-leg-${side}`,side*68,9,66,1,18,1,'metal');box(`crane-beam-${side}`,side*63,18,66,16,1,2,'metal')
  }
  if(environment==='airfield'){
    for(const side of [-1,1])for(let z=-60;z<=60;z+=20)box(`runway-light-${side}-${z}`,c.x+side*7,.2,z,.3,.4,.3,'metal')
    box('radar-mast',-68,8,0,.8,16,.8,'metal');box('radar-array',-68,15,0,8,3,.6,'metal')
  }
  if(id==='iron-route')for(const side of [-1,1]){
    box(`rail-car-${side}`,c.x+side*11,1.7,c.z,4,3.4,17,'metal')
    for(const rail of [-1,1])box(`rail-track-${side}-${rail}`,c.x+side*11+rail*1.3,.025,c.z,.12,.05,36,'metal')
  }
  if(id==='cold-water')for(const side of [-1,1]){
    box(`reservoir-basin-${side}`,c.x+side*12,.7,c.z,8,1.4,14,'concrete')
    box(`reservoir-water-${side}`,c.x+side*12,1.42,c.z,7.3,.04,13.3,'metal')
  }
  if(id==='deep-cut'||id==='open-horizon')for(const side of [-1,1]){
    buildings.push({id:`${id}-bunker-${side}`,name:'RIDGE / GUARD HOUSE',x:c.x+side*14,z:c.z+4,width:9,depth:9,height:3.8,architecture:'bunker',material:'concrete',doors:['south','north']})
    box(`ridge-cover-${side}`,c.x+side*10,.65,c.z-10,5,1.3,1,'concrete')
  }
  for(const side of [-1,1]) {
    const x=c.x+side*13,z=c.z
    if(id==='burn-line'){
      box(`sector-fuel-tank-${side}`,x,2.7,z,7,5.4,8,'metal');box(`fuel-pipe-${side}`,x,.65,z-7,.7,1.3,7,'metal')
    } else if(id==='chain-reaction') {
      buildings.push({id:`${id}-forge-${side}`,name:'IRONWORKS / FURNACE HALL',x,z,width:12,depth:14,height:8,doorWidth:5,architecture:'hall',material:'brick',doors:['south','north']});box(`forge-chimney-${side}`,x+4,11,z+4,2,6,2,'metal')
    } else if(id==='ghost-frequency'||id==='silent-current'||id==='hard-reset') {
      box(`signal-mast-${side}`,x,9,z,.6,18,.6,'metal');box(`signal-array-${side}`,x,15,z,8,2,.4,'metal')
      box(`signal-console-${side}`,x,1,z-5,3,2,2,'metal')
    } else if(id==='market-fire') {
      box(`market-canopy-${side}`,x,3.1,z,9,.25,6,'wood');box(`market-counter-${side}`,x,.6,z,7,1.2,1.2,'wood')
      for(const edge of [-1,1])box(`market-post-${side}-${edge}`,x+edge*4,1.5,z-2.5,.18,3,.18,'wood')
    } else if(id==='long-watch') {
      buildings.push({id:`${id}-watchpost-${side}`,name:'RANGER / WATCH POST',x,z,width:8,depth:9,height:3.8,architecture:'house',material:'wood',doors:['south','north']})
      box(`field-log-cover-${side}`,x,.55,z-7,7,1.1,1,'wood')
    } else if(id==='dust-trail'||id==='white-flag') {
      box(`field-tent-${side}`,x,1.3,z,7,2.6,9,'wood')
      box(`medical-supplies-${side}`,x,.5,z-7,3,1,1.5,'metal')
    } else if(id==='sealed-cargo') {
      box(`container-stack-${side}`,x,3.2,z,8,6.4,12,'metal')
    } else if(id==='broken-wing'||id==='last-approach') {
      const px=c.x+side*21
      box(`aircraft-fuselage-${side}`,px,2.5,z,2.4,2.4,14,'metal')
      box(`aircraft-wing-${side}`,px,2.4,z,17,.24,3.3,'metal')
      for(const engine of [-1,1])box(`aircraft-engine-${side}-${engine}`,px+engine*3.5,2.15,z-1.5,1,1,3,'metal')
      box(`aircraft-tailplane-${side}`,px,3.3,z+5.5,7,.2,2,'metal')
      box(`aircraft-tailfin-${side}`,px,4.4,z+5.5,.22,3,2.5,'metal')
      for(const leg of [-1,1])box(`aircraft-gear-${side}-${leg}`,px+leg*1.2,.7,z+2,.45,1.4,.9,'metal')
      box(`aircraft-nose-gear-${side}`,px,.7,z-4,.4,1.4,.8,'metal')
      if(id==='last-approach'){box(`airfield-control-mast-${side}`,x,10,z+9,.6,20,.6,'metal');box(`airfield-control-array-${side}`,x,18,z+9,6,1,1,'metal')}
    }
  }
  const roads=environment==='urban'?[-28,28]:environment==='airfield'?[c.x]:[]
  populateSector(id,environment,variant,buildings,solids,Object.values(points),roads)
  const world=createCampaignArena(id,name,82+(variant%3)*4,buildings,solids,roads)
  world.environment=environment
  world.navigationPoints=[...world.navigationPoints!,...Object.values(points)]
  const guards:Position[]=[]
  for(const point of [points.west,points.east,points.north,points.south,points.exit])for(const [dx,dz] of [[-3,-2],[3,-2],[-3,2],[3,2]])guards.push({x:point.x+(environment==='airfield'&&point===points.north?dx!*2/3:dx!),y:0,z:point.z+dz!})
  return {world,points,guards}
}
