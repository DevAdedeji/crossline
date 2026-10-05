/** Original procedural block. Coordinates are meters; y is feet-height. */
export interface Solid {
  id: string
  x: number; y: number; z: number
  width: number; height: number; depth: number
  material: 'plaster' | 'brick' | 'concrete' | 'roof' | 'metal' | 'wood'
}
export interface Building {
  id: string; name: string; x: number; z: number; width: number; depth: number
  height?: number
  doorWidth?: number
  architecture?: 'house' | 'shop' | 'workshop' | 'hall' | 'clinic' | 'bunker' | 'terrace' | 'apartment' | 'terminal' | 'ruin' | 'station' | 'market' | 'tower' | 'hangar'
  material: Solid['material']; doors: ('north' | 'south' | 'east' | 'west')[]
}
export interface ParkedCar {
  id: string; x: number; z: number; sideways: boolean; color: string
}
export const BLOCK_NAME = 'MERCER BLOCK'
export const ROOF_HEIGHT = 4.1
export const BUILDINGS: Building[] = [
  { id: 'cafe', name: 'MERCER / CAFE', x: -12, z: 11, width: 12, depth: 10, material: 'plaster', doors: ['east', 'north'] },
  { id: 'garage', name: 'NORTHSIDE / WORKS', x: 13, z: 12, width: 12, depth: 10, material: 'brick', doors: ['west', 'south'] },
  { id: 'store', name: 'BLOCK / SUPPLY', x: -14, z: -13, width: 12, depth: 10, material: 'concrete', doors: ['east', 'north'] },
]
export const PARKED_CARS: ParkedCar[] = [
  { id: 'car-south', x: -3, z: -12, sideways: false, color: '#a4583f' },
  { id: 'car-north', x: 3, z: 12, sideways: false, color: '#5a7e83' },
  { id: 'car-cross', x: 13, z: -1.9, sideways: true, color: '#d3bb7a' },
  { id: 'van-west', x: -13, z: 1.9, sideways: true, color: '#8c9a85' },
]
export const RAMP = { id: 'roof-ramp', minX: -21.5, maxX: -18.5, minZ: 5.5, maxZ: 15, height: ROOF_HEIGHT }
export function rampHeight(z: number): number {
  return Math.max(0, Math.min(1, (z - RAMP.minZ) / (RAMP.maxZ - RAMP.minZ))) * RAMP.height
}
export const SPAWNS = Array.from({ length: 8 }, (_, index) => ({ x: -3 + (index % 4) * 2, y: 0, z: -22 - Math.floor(index / 4) * 2 }))

const solids: Solid[] = []
function box(id: string, x: number, y: number, z: number, width: number, height: number, depth: number, material: Solid['material']) {
  solids.push({ id, x, y, z, width, height, depth, material })
}
for (const building of BUILDINGS) {
  for (const side of ['north', 'south', 'east', 'west'] as const) {
    const horizontal = side === 'north' || side === 'south'
    const length = horizontal ? building.width : building.depth
    const sign = side === 'north' || side === 'east' ? 1 : -1
    const x = horizontal ? building.x : building.x + sign * building.width / 2
    const z = horizontal ? building.z + sign * building.depth / 2 : building.z
    const door = building.doors.includes(side)
    if (door) {
      const segment = (length - 2.4) / 2
      for (const direction of [-1, 1]) {
        const offset = direction * (1.2 + segment / 2)
        box(`${building.id}-${side}-${direction}`, x + (horizontal ? offset : 0), 1.9, z + (horizontal ? 0 : offset), horizontal ? segment : 0.4, 3.8, horizontal ? 0.4 : segment, building.material)
      }
      box(`${building.id}-${side}-lintel`, x, 3.2, z, horizontal ? 2.4 : 0.4, 1.2, horizontal ? 0.4 : 2.4, building.material)
    } else box(`${building.id}-${side}`, x, 1.9, z, horizontal ? length : 0.4, 3.8, horizontal ? 0.4 : length, building.material)
  }
  box(`${building.id}-roof`, building.x, 3.95, building.z, building.width + 0.6, 0.3, building.depth + 0.6, 'roof')
  // Roof parapets leave the cafe's west access open for the ramp landing.
  for (const side of ['north', 'south', 'east', 'west'] as const) {
    if (building.id === 'cafe' && side === 'west') continue
    const horizontal = side === 'north' || side === 'south'
    const sign = side === 'north' || side === 'east' ? 1 : -1
    box(`${building.id}-parapet-${side}`, building.x + (horizontal ? 0 : sign * building.width / 2), 4.5, building.z + (horizontal ? sign * building.depth / 2 : 0), horizontal ? building.width : 0.2, 0.8, horizontal ? 0.2 : building.depth, building.material)
  }
}
box('roof-landing', -19.7, 3.95, 15.5, 3.6, 0.3, 1.0, 'metal')
for (const [id, x, z, width, depth, height] of [
  ['cafe-counter', -15, 9, 3, 0.9, 1.1], ['garage-bench', 16, 15, 3.2, 1, 1.1],
  ['store-shelf', -17, -15.5, 3.5, 0.9, 2], ['crate-a', 15, -12, 1.5, 1.5, 1.4],
  ['crate-b', 17, -12, 1.5, 1.5, 1.4], ['crate-c', 17, -14, 1.5, 1.5, 2.6],
  ['bin-alley', -22.8, 1, 1.4, 2.3, 1.5], ['roof-ac', -9, 12.5, 2, 1.5, 1.2],
] as const) box(id, x, height / 2 + (id === 'roof-ac' ? ROOF_HEIGHT : 0), z, width, height, depth, id.startsWith('crate') || id.includes('counter') ? 'wood' : 'metal')
for (const [x, z, width, depth] of [[0, 26.6, 53.2, 0.4], [0, -26.6, 53.2, 0.4], [-26.6, 0, 0.4, 53.2], [26.6, 0, 0.4, 53.2]]) box(`boundary-${x}-${z}`, x!, 1.2, z!, width!, 2.4, depth!, 'concrete')
for (const [x, z] of [[-5.2, -3.8], [5.2, 4.2], [22, -18], [-23, 21]]) box(`lamp-${x}-${z}`, x!, 2.3, z!, 0.16, 4.6, 0.16, 'metal')
for (const [x, z] of [[21, 20], [21, -20], [-23, -22]]) box(`planter-${x}-${z}`, x!, 0.4, z!, 2.2, 0.8, 2.2, 'concrete')
// Street seating uses conservative shared bounds, so its visible backs and seats are solid cover.
for (const [x,z] of [[18,20],[18,-20],[-22,-19]])
  box(`street-bench-${x}-${z}`,x!,.45,z!,2.5,.9,.85,'wood')
export const MAP_SOLIDS: readonly Solid[] = solids
export const CAR_COLLIDERS: readonly Solid[] = PARKED_CARS.map((car) => ({ id: car.id, x: car.x, y: 0.78, z: car.z, width: car.sideways ? 4.5 : 2, height: 1.56, depth: car.sideways ? 2 : 4.5, material: 'metal' }))
export const COLLIDERS: readonly Solid[] = [...MAP_SOLIDS, ...CAR_COLLIDERS]

export interface WorldGeometry {
  place?: {identity:string; atmosphere:'day'|'overcast'|'haze'; preview:{eye:[number,number,number];target:[number,number,number]}}
  surfaces?: readonly {x:number;z:number;width:number;depth:number;kind:'asphalt'|'grass'|'paving'|'apron'|'rail'}[]
  environment?: 'industrial' | 'coastal' | 'forest' | 'desert' | 'urban' | 'airfield'
  legacyRamp?: boolean
  navigationPoints?: readonly {x:number;y:number;z:number}[]
  id: string
  name: string
  limit: number
  buildings: readonly Building[]
  solids: readonly Solid[]
  cars: readonly ParkedCar[]
  colliders: readonly Solid[]
  roadCenters: readonly number[]
}
export const TRAINING_WORLD: WorldGeometry = {
  id: 'mercer-training', name: BLOCK_NAME, limit: 26,
  buildings: BUILDINGS, solids: MAP_SOLIDS, cars: PARKED_CARS, colliders: COLLIDERS,
  roadCenters: [0],
}
const spatial = new WeakMap<WorldGeometry, Map<string, Solid[]>>()
/** Broad phase shared by authoritative movement and navigation. */
export function nearbySolids(world: WorldGeometry, x: number, z: number): readonly Solid[] {
  let cells = spatial.get(world)
  if (!cells) {
    cells = new Map()
    for (const solid of world.colliders) {
      for (let cx = Math.floor((solid.x-solid.width/2-.4)/8); cx <= Math.floor((solid.x+solid.width/2+.4)/8); cx++)
        for (let cz = Math.floor((solid.z-solid.depth/2-.4)/8); cz <= Math.floor((solid.z+solid.depth/2+.4)/8); cz++) {
          const key = `${cx}/${cz}`, list = cells.get(key) ?? []
          list.push(solid); cells.set(key, list)
        }
    }
    spatial.set(world, cells)
  }
  return cells.get(`${Math.floor(x/8)}/${Math.floor(z/8)}`) ?? []
}

/** Conservative grid traversal; exact ray/box clipping remains the narrow phase. */
export function raySolids(world:WorldGeometry,origin:{x:number;z:number},ray:{x:number;z:number},range:number):readonly Solid[] {
 const found=new Set<Solid>()
 let cx=Math.floor(origin.x/8),cz=Math.floor(origin.z/8)
 const sx=Math.sign(ray.x),sz=Math.sign(ray.z)
 const dx=sx===0?Infinity:8/Math.abs(ray.x),dz=sz===0?Infinity:8/Math.abs(ray.z)
 let tx=sx===0?Infinity:((cx+(sx>0?1:0))*8-origin.x)/ray.x
 let tz=sz===0?Infinity:((cz+(sz>0?1:0))*8-origin.z)/ray.z
 for(;;){
  for(const solid of nearbySolids(world,cx*8+4,cz*8+4))found.add(solid)
  const next=Math.min(tx,tz)
  if(!Number.isFinite(next)||next>range)break
  if(tx<=tz){cx+=sx;tx+=dx}else{cz+=sz;tz+=dz}
 }
 return [...found]
}
