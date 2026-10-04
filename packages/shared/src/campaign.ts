import { TRAINING_WORLD, type Building, type Solid, type WorldGeometry } from './urban-map.ts'
import type { Position } from './index.ts'

export const EXTRACTION_MISSION = {
  id: 'last-signal', chapter: '01', title: 'The last signal', operation: 'Operation Breakwater',
  briefing: 'Mercer has gone dark. An informant known as Finch has the evacuation routes, but a hostile unit is holding them at Harbour Relay. Cross the depot, disable its alarm relay, and bring Finch home.',
  debrief: 'Finch is safe. The recovered routes point to a weapons shipment moving through the harbour. Breakwater has its first lead.',
  relay: { x: 0, y: 0, z: 28 }, captive: { x: 60, y: 0, z: 54 }, extraction: { x: -66, y: 0, z: -64 },
  spawn: { x: 0, y: 0, z: -70 }, rescueSpawn: { x: 54, y: 0, z: 44 }, escortSpawn: { x: 60, y: 0, z: 50 },
  interactMs: 2200, extractMs: 5000, interactionRadius: 2.8, extractionRadius: 5,
} as const
export type CampaignStage = 'relay' | 'rescue' | 'extract'
export interface CampaignProgress {
  version: 1
  checkpoint: CampaignStage
  cleared: string[]
  completed: boolean
  elapsedMs?: number
  bestTimeMs?: number
}
export interface CampaignState {
  stage: CampaignStage
  outcome: 'active' | 'success' | 'failed'
  checkpoint: CampaignStage
  progressMs: number
  canInteract: boolean
  captive: Position & { yaw: number }
  following: boolean
  waiting: boolean
  radio: string
  save: CampaignProgress
}
export const CAMPAIGN_OBJECTIVES: Record<CampaignStage, { title: string; instruction: string; position: Position }> = {
  relay: { title: 'Disable the alarm relay', instruction: 'Reach the relay in the north courtyard. Step into its circle and stay there to disable it.', position: EXTRACTION_MISSION.relay },
  rescue: { title: 'Recover Finch', instruction: 'Find Finch inside the blue relay office. Step into their circle to release them automatically.', position: EXTRACTION_MISSION.captive },
  extract: { title: 'Escort Finch to extraction', instruction: 'Keep Finch close. Reach the southwest extraction zone together and stay inside for five seconds.', position: EXTRACTION_MISSION.extraction },
}
export function parseCampaignProgress(value: unknown): CampaignProgress {
  const empty: CampaignProgress = { version: 1, checkpoint: 'relay', cleared: [], completed: false }
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return empty
  const data = value as Partial<CampaignProgress>
  if (!['relay', 'rescue', 'extract'].includes(data.checkpoint ?? '') || typeof data.completed !== 'boolean') return empty
  return { ...empty, checkpoint: data.checkpoint!, completed: data.completed,
    cleared: Array.isArray(data.cleared) ? [...new Set(data.cleared.filter(id => typeof id === 'string' && /^bot-\d+$/.test(id) && Number(id.slice(4)) < CAMPAIGN_GUARDS.length))] : [],
    ...(typeof data.elapsedMs === 'number' && Number.isFinite(data.elapsedMs) && data.elapsedMs >= 0 ? { elapsedMs: Math.min(data.elapsedMs, 3600000) } : {}),
    ...(typeof data.bestTimeMs === 'number' && Number.isFinite(data.bestTimeMs) && data.bestTimeMs > 0 ? { bestTimeMs: data.bestTimeMs } : {}),
  }
}

// Harbour Relay retains the central block's proven ramp, then opens into a new
// enclosed depot. Collision, AI routes and the renderer all use this geometry.
const buildings: Building[] = [...TRAINING_WORLD.buildings,
  { id: 'relay-office', name: 'HARBOUR RELAY / OFFICE', x: 60, z: 54, width: 12, depth: 10, material: 'plaster', doors: ['south', 'west'] },
  { id: 'depot-store', name: 'CUSTOMS / STORAGE', x: -32, z: 30, width: 12, depth: 10, material: 'brick', doors: ['south', 'east'] },
  { id: 'customs-east', name: 'CUSTOMS / INSPECTION', x: 44, z: 14, width: 12, depth: 10, material: 'concrete', doors: ['south','north'] },
  { id: 'dock-workshop', name: 'DOCK / WORKSHOP', x: 66, z: -14, width: 12, depth: 10, material: 'brick', doors: ['west','south'] },
  { id: 'west-dispatch', name: 'WEST / DISPATCH', x: -60, z: 18, width: 12, depth: 10, material: 'plaster', doors: ['east','south'] },
  { id: 'freight-office', name: 'FREIGHT / CONTROL', x: -48, z: -42, width: 12, depth: 10, material: 'metal', doors: ['east','north'] },
  { id: 'south-barracks', name: 'SOUTH / BARRACKS', x: 22, z: -56, width: 12, depth: 10, material: 'plaster', doors: ['west','north'] },
  { id: 'north-stores', name: 'NORTH / STORES', x: 22, z: 60, width: 12, depth: 10, material: 'brick', doors: ['east','south'] },
  { id: 'harbour-security', name: 'HARBOUR / SECURITY', x: -28, z: 62, width: 12, depth: 10, material: 'concrete', doors: ['east','south'] },
]
const solids: Solid[] = TRAINING_WORLD.solids.filter(s => !s.id.startsWith('boundary-'))
function box(id: string, x: number, y: number, z: number, width: number, height: number, depth: number, material: Solid['material']) {
  solids.push({ id, x, y, z, width, height, depth, material })
}
for (const building of buildings.slice(TRAINING_WORLD.buildings.length)) {
  for (const side of ['north', 'south', 'east', 'west'] as const) {
    const horizontal = side === 'north' || side === 'south', sign = side === 'north' || side === 'east' ? 1 : -1
    const length = horizontal ? building.width : building.depth
    const x = building.x + (horizontal ? 0 : sign * building.width / 2), z = building.z + (horizontal ? sign * building.depth / 2 : 0)
    if (building.doors.includes(side)) {
      const segment = (length - 3) / 2
      for (const direction of [-1, 1]) {
        const offset = direction * (1.5 + segment / 2)
        box(`${building.id}-${side}-${direction}`, x + (horizontal ? offset : 0), 1.9, z + (horizontal ? 0 : offset), horizontal ? segment : .4, 3.8, horizontal ? .4 : segment, building.material)
      }
      box(`${building.id}-${side}-lintel`, x, 3.4, z, horizontal ? 3 : .4, .8, horizontal ? .4 : 3, building.material)
    } else box(`${building.id}-${side}`, x, 1.9, z, horizontal ? length : .4, 3.8, horizontal ? .4 : length, building.material)
  }
  box(`${building.id}-roof`, building.x, 3.95, building.z, 12.6, .3, 10.6, 'roof')
}
for (const [x,z,w,d] of [[0,85,171,.6],[0,-85,171,.6],[-85,0,.6,170],[85,0,.6,170]]) box(`depot-boundary-${x}-${z}`,x!,1.7,z!,w!,3.4,d!,'concrete')
for (const [x,z] of [[-30,-10],[28,-20],[-15,32],[17,33],[-62,-10],[-54,-14],[-62,-18],[46,-42],[54,-44],[62,-42],[38,60],[38,68],[-50,52],[-58,56]]) {
  box(`freight-${x}-${z}`,x!,1.4,z!,5.5,2.8,3,'metal')
  for (const side of [-1,1]) box(`freight-rib-${x}-${z}-${side}`,x!+side*2.5,1.4,z!, .1,2.8,3.05,'metal')
}
// Staggered barricades form approaches to the office without sealing either door.
for (const [x,z,w,d] of [[50,47,5,.7],[70,46,5,.7],[49,61,.7,5],[73,61,.7,5],[-58,-56,5,.7],[-72,-56,5,.7]]) box(`checkpoint-cover-${x}-${z}`,x!, .6,z!,w!,1.2,d!,'concrete')
for (const [x,z] of [[-74,44],[-72,-28],[72,26],[40,74]]) box(`planter-${x}-${z}`,x!, .4,z!,2.2,.8,2.2,'concrete')
for (const [x,z] of [[-36,-54],[36,38],[66,42],[-66,-42]]) box(`lamp-${x}-${z}`,x!,2.3,z!,.16,4.6,.16,'metal')
box('relay-terminal',0,.7,29.8,1.2,1.4,.5,'metal')
box('relay-mast',-2,5,31,.3,10,.3,'metal')
box('relay-crossbar',-2,8,31,4,.12,.12,'metal')
const cars = [...TRAINING_WORLD.cars, { id: 'extraction-car', x: -71, z: -67, sideways: true, color: '#435b53' }]
export const CAMPAIGN_WORLD: WorldGeometry = {
  id: 'harbour-relay', name: 'HARBOUR RELAY', limit: 84, buildings, solids, cars, roadCenters: [-66, -36, 0, 36, 66],
  colliders: [...solids, ...cars.map(car => ({ id: car.id, x: car.x, y: .78, z: car.z, width: car.sideways ? 4.5 : 2, height: 1.56, depth: car.sideways ? 2 : 4.5, material: 'metal' as const }))],
  navigationPoints: [EXTRACTION_MISSION.relay, EXTRACTION_MISSION.captive, EXTRACTION_MISSION.extraction, ...buildings.slice(3).flatMap(b => [{x:b.x,y:0,z:b.z-7},{x:b.x,y:0,z:b.z-3},{x:b.x-8,y:0,z:b.z},{x:b.x+8,y:0,z:b.z}])],
}
export const CAMPAIGN_GUARDS: Position[] = [
  { x: 5, y: 0, z: -48 }, { x: -5, y: 0, z: 7 }, { x: 5, y: 0, z: 23 },
  { x: 52, y: 0, z: 44 }, { x: 60, y: 0, z: 52 }, { x: -24, y: 0, z: 23 }, { x: 24, y: 0, z: -28 },
  { x: 68, y: 0, z: 44 }, { x: 55, y: 0, z: 56 }, { x: 64, y: 0, z: 56 },
  { x: 50, y: 0, z: 63 }, { x: 71, y: 0, z: 62 }, { x: 44, y: 0, z: 28 },
  { x: -56, y: 0, z: -28 }, { x: -26, y: 0, z: -54 }, { x: 15, y: 0, z: -44 },
]
