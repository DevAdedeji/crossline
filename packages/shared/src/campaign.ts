import { TRAINING_WORLD, type Building, type Solid, type WorldGeometry } from './urban-map.ts'
import type { Position } from './index.ts'

export const EXTRACTION_MISSION = {
  id: 'last-signal', chapter: '01', title: 'The last signal', operation: 'Operation Breakwater',
  briefing: 'Mercer has gone dark. An informant known as Finch has the evacuation routes, but a hostile unit is holding them at Harbour Relay. Cross the depot, disable its alarm relay, and bring Finch home.',
  debrief: 'Finch is safe. The recovered routes point to a weapons shipment moving through the harbour. Breakwater has its first lead.',
  relay: { x: 0, y: 0, z: 28 }, captive: { x: 32, y: 0, z: 30 }, extraction: { x: -36, y: 0, z: -36 },
  spawn: { x: 0, y: 0, z: -38 }, rescueSpawn: { x: 0, y: 0, z: 25 }, escortSpawn: { x: 32, y: 0, z: 26 },
  interactMs: 2200, extractMs: 5000,
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
  relay: { title: 'Disable the alarm relay', instruction: 'Reach the relay in the north courtyard. Hold interact beside the terminal.', position: EXTRACTION_MISSION.relay },
  rescue: { title: 'Recover Finch', instruction: 'Find Finch inside the blue relay office. Hold interact to release them.', position: EXTRACTION_MISSION.captive },
  extract: { title: 'Escort Finch to extraction', instruction: 'Keep Finch close. Reach the southwest extraction zone together and hold for five seconds.', position: EXTRACTION_MISSION.extraction },
}
export function parseCampaignProgress(value: unknown): CampaignProgress {
  const empty: CampaignProgress = { version: 1, checkpoint: 'relay', cleared: [], completed: false }
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return empty
  const data = value as Partial<CampaignProgress>
  if (!['relay', 'rescue', 'extract'].includes(data.checkpoint ?? '') || typeof data.completed !== 'boolean') return empty
  return { ...empty, checkpoint: data.checkpoint!, completed: data.completed,
    cleared: Array.isArray(data.cleared) ? [...new Set(data.cleared.filter(id => typeof id === 'string' && /^bot-[0-6]$/.test(id)))] : [],
    ...(typeof data.elapsedMs === 'number' && Number.isFinite(data.elapsedMs) && data.elapsedMs >= 0 ? { elapsedMs: Math.min(data.elapsedMs, 3600000) } : {}),
    ...(typeof data.bestTimeMs === 'number' && Number.isFinite(data.bestTimeMs) && data.bestTimeMs > 0 ? { bestTimeMs: data.bestTimeMs } : {}),
  }
}

// Harbour Relay retains the central block's proven ramp, then opens into a new
// enclosed depot. Collision, AI routes and the renderer all use this geometry.
const buildings: Building[] = [...TRAINING_WORLD.buildings,
  { id: 'relay-office', name: 'HARBOUR RELAY / OFFICE', x: 32, z: 30, width: 12, depth: 10, material: 'plaster', doors: ['south', 'west'] },
  { id: 'depot-store', name: 'CUSTOMS / STORAGE', x: -32, z: 30, width: 12, depth: 10, material: 'brick', doors: ['south', 'east'] },
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
for (const [x,z,w,d] of [[0,49,99,.6],[0,-49,99,.6],[-49,0,.6,98],[49,0,.6,98]]) box(`depot-boundary-${x}-${z}`,x!,1.7,z!,w!,3.4,d!,'concrete')
for (const [x,z] of [[-30,-10],[28,-20],[-15,32],[17,33]]) {
  box(`freight-${x}-${z}`,x!,1.4,z!,5.5,2.8,3,'metal')
  for (const side of [-1,1]) box(`freight-rib-${x}-${z}-${side}`,x!+side*2.5,1.4,z!, .1,2.8,3.05,'metal')
}
box('relay-terminal',0,.7,29.8,1.2,1.4,.5,'metal')
box('relay-mast',-2,5,31,.3,10,.3,'metal')
box('relay-crossbar',-2,8,31,4,.12,.12,'metal')
const cars = [...TRAINING_WORLD.cars, { id: 'extraction-car', x: -40, z: -39, sideways: true, color: '#435b53' }]
export const CAMPAIGN_WORLD: WorldGeometry = {
  id: 'harbour-relay', name: 'HARBOUR RELAY', limit: 48, buildings, solids, cars, roadCenters: [0, -36, 36],
  colliders: [...solids, ...cars.map(car => ({ id: car.id, x: car.x, y: .78, z: car.z, width: car.sideways ? 4.5 : 2, height: 1.56, depth: car.sideways ? 2 : 4.5, material: 'metal' as const }))],
  navigationPoints: [EXTRACTION_MISSION.relay, EXTRACTION_MISSION.captive, EXTRACTION_MISSION.extraction, ...buildings.slice(3).flatMap(b => [{x:b.x,y:0,z:b.z-7},{x:b.x,y:0,z:b.z-3},{x:b.x-8,y:0,z:b.z},{x:b.x+8,y:0,z:b.z}])],
}
export const CAMPAIGN_GUARDS: Position[] = [
  { x: 5, y: 0, z: -21 }, { x: -5, y: 0, z: 7 }, { x: 5, y: 0, z: 23 },
  { x: 23, y: 0, z: 22 }, { x: 32, y: 0, z: 28 }, { x: -24, y: 0, z: 23 }, { x: 24, y: 0, z: -28 },
]
