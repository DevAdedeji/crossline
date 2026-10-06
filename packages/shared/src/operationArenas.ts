import { populatePlace } from './sectorArchitecture.js'
import { OPERATION_PLACES } from './operationPlaces.js'
import { createCampaignArena } from './campaignArenas.js'
import type { Position } from './index.js'
import type { Building, Solid, WorldGeometry } from './urban-map.js'
export type OperationLocation =
  | 'insertion'
  | 'south'
  | 'west'
  | 'center'
  | 'east'
  | 'north'
  | 'exit'
export type OperationEnvironment = NonNullable<WorldGeometry['environment']>
export interface OperationArena {
  world: WorldGeometry
  points: Record<OperationLocation, Position>
  guards: Position[]
}
export function operationArena(
  id: string,
  name: string,
  environment: OperationEnvironment,
  _variant: number,
): OperationArena {
  const plan = OPERATION_PLACES[id]!
  const buildings: Building[] = plan.addresses.map(
    ([name, x, z, width, depth, architecture, height], index) => ({
      id: `${id}-${['west', 'east', 'north'][index] ?? `address-${index}`}`,
      name,
      x,
      z,
      width,
      depth,
      architecture,
      height: height ?? 3.8,
      doorWidth:
        architecture === 'hall' || architecture === 'hangar'
          ? Math.min(12, width * 0.4)
          : architecture === 'terminal' || architecture === 'market'
            ? 5
            : 3,
      material:
        architecture === 'hall' || architecture === 'hangar'
          ? 'metal'
          : architecture === 'ruin' || architecture === 'station'
            ? 'brick'
            : 'plaster',
      doors:
        architecture === 'apartment'
          ? ['south', 'north', 'east']
          : ['hall', 'hangar', 'house', 'ruin'].includes(architecture)
            ? ['south', 'north']
            : ['south', 'north', 'east', 'west'],
    }),
  )
  const point = ([x, z]: readonly number[]): Position => ({ x: x!, y: 0, z: z! })
  const points: Record<OperationLocation, Position> = {
    insertion: point(plan.insertion),
    south: point(plan.south),
    center: point(plan.center),
    exit: point(plan.exit),
    west: point([buildings[0]!.x, buildings[0]!.z]),
    east: point([buildings[1]!.x, buildings[1]!.z]),
    north: point([buildings[2]!.x, buildings[2]!.z]),
  }
  const solids: Solid[] = []
  const cars = populatePlace(id, plan, buildings, solids, Object.values(points))
  const world = createCampaignArena(id, name, plan.limit, buildings, solids, [])
  world.environment = environment
  world.surfaces = plan.surfaces
  world.place = { identity: plan.identity, atmosphere: plan.atmosphere, preview: plan.preview }
  world.cars = cars
  world.colliders = [
    ...solids,
    ...cars.map((c) => ({
      id: c.id,
      x: c.x,
      y: 0.78,
      z: c.z,
      width: c.sideways ? 4.5 : 2,
      height: 1.56,
      depth: c.sideways ? 2 : 4.5,
      material: 'metal' as const,
    })),
  ]
  world.navigationPoints = [...world.navigationPoints!, ...Object.values(points)]
  const guards: Position[] = []
  for (const location of ['west', 'east', 'north', 'south', 'exit'] as const)
    for (const [dx, dz] of [
      [-3, -2],
      [3, -2],
      [-3, 2],
      [3, 2],
    ])
      guards.push({ x: points[location].x + dx!, y: 0, z: points[location].z + dz! })
  return { world, points, guards }
}
