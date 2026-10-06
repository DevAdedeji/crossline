import type { Building, Solid, ParkedCar } from './urban-map.js'
import type { Position } from './index.js'
import type { OperationPlace } from './operationPlaces.js'

/** Site contents have a use: household furniture, public amenities, vehicles and machinery. */
export function populatePlace(
  id: string,
  plan: OperationPlace,
  buildings: Building[],
  solids: Solid[],
  objectives: Position[],
): ParkedCar[] {
  const cars: ParkedCar[] = []
  function box(
    name: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    material: Solid['material'] = 'metal',
  ) {
    if (
      y - height / 2 < 2 &&
      objectives.some(
        (p) => Math.abs(p.x - x) < width / 2 + 4.2 && Math.abs(p.z - z) < depth / 2 + 3.3,
      )
    )
      return
    solids.push({ id: `${name}-${solids.length}`, x, y, z, width, height, depth, material })
  }
  for (const b of buildings) {
    const x = b.x,
      z = b.z,
      w = b.width,
      d = b.depth,
      h = b.height ?? 3.8,
      kind = b.architecture
    if (kind === 'workshop' && w < 12) {
      box('equipment-cabinet', x - w / 2 + 1, 0.6, z + d / 2 - 1, 1, 1.2, 1)
    } else if (kind === 'hall' || kind === 'workshop' || kind === 'hangar') {
      for (const side of [-1, 1]) {
        box(`factory-machine-${b.id}`, x + side * (w / 2 - 3), 1.1, z + d * 0.25, 3, 2.2, 4)
        box(`factory-conveyor-${b.id}`, x + side * (w / 2 - 3), 0.6, z - d * 0.27, 2, 1.2, 3)
        if (id === 'chain-reaction' || id === 'burn-line')
          box(
            `factory-stack-${b.id}`,
            x + side * (w / 2 - 2),
            h + 3,
            z + d / 2 - 2,
            1.5,
            6,
            1.5,
            'brick',
          )
      }
    } else if (kind === 'terminal' || kind === 'station') {
      for (const side of [-1, 1])
        for (const offset of [-0.28, 0.28])
          box('public-seating', x + side * w * 0.32, 0.48, z + offset * d, 3, 0.96, 1, 'wood')
      box('ticket-counter', x + w * 0.3, 0.6, z - d * 0.3, 5, 1.2, 1.1)
      if (kind === 'terminal')
        for (const side of [-1, 1]) box('baggage-carousel', x + side * w * 0.3, 0.45, z, 5, 0.9, 3)
    } else if (kind === 'market') {
      for (const side of [-1, 1])
        for (const offset of [-0.28, 0.28]) {
          box('market-counter', x + side * w * 0.3, 0.65, z + offset * d, 4, 1.3, 2, 'wood')
          box('market-canopy', x + side * w * 0.3, 2.7, z + offset * d, 5, 0.15, 3, 'wood')
        }
    } else if (kind !== 'tower') {
      box(
        kind === 'clinic' ? 'clinic-bed' : 'home-sofa',
        x - w * 0.3,
        0.4,
        z + d * 0.3,
        2.4,
        0.8,
        1,
        'wood',
      )
      box(
        kind === 'shop' ? 'shop-counter' : 'home-table',
        x + w * 0.3,
        0.45,
        z - d * 0.3,
        2.5,
        0.9,
        1.3,
        'wood',
      )
      if (kind === 'house' || kind === 'terrace' || kind === 'ruin')
        box('home-bed', x + w * 0.3, 0.35, z + d * 0.3, 1.5, 0.7, 2.2, 'wood')
    }
    if (kind === 'house' || kind === 'terrace')
      for (const side of [-1, 1]) {
        box('garden-wall', x + side * (w / 2 + 0.7), 0.45, z - d / 2 - 2, 0.25, 0.9, 4, 'brick')
        box('planter', x + side * (w / 2 - 1), 0.3, z - d / 2 - 3.2, 1.1, 0.6, 1.1, 'concrete')
      }
    if (kind === 'ruin')
      for (const side of [-1, 1]) {
        box('rubble', x + side * w * 0.3, 0.22, z - d / 2 - 1.1, 2.1, 0.44, 1.3, 'brick')
        box(
          'planter-overgrown',
          x + side * (w / 2 - 1),
          0.12,
          z + d / 2 + 1.5,
          1.5,
          0.24,
          1.5,
          'concrete',
        )
      }
    if (kind === 'tower') {
      box('tower-observation-cabin', x, h + 1.6, z, w + 4, 3.2, d + 3)
      box('tower-observation-roof', x, h + 3.4, z, w + 5, 0.4, d + 4, 'roof')
      box('tower-antenna', x, h + 5, z, 0.15, 3, 0.15)
    }
  }
  const center = { x: plan.center[0], z: plan.center[1] }
  // Site-defining structures have deliberately different footprints and routes around them.
  if (id === 'blackout')
    for (const [x, z] of [
      [8, 19],
      [27, 35],
      [47, 4],
    ] as const)
      box('transformer', x, 1.7, z, 5, 3.4, 8)
  if (id === 'iron-route')
    for (const [x, z] of [
      [22, -45],
      [42, 9],
      [21, 61],
    ] as const)
      box('rail-car', x, 1.7, z, 4, 3.4, 19)
  if (id === 'cold-water')
    for (const [x, z] of [
      [8, -4],
      [30, 38],
    ] as const) {
      box('reservoir-basin', x, 0.7, z, 14, 1.4, 17, 'concrete')
      box('reservoir-water', x, 1.42, z, 13.3, 0.04, 16.3)
    }
  if (id === 'burn-line')
    for (const [x, z] of [
      [6, 23],
      [27, 36],
      [21, -12],
    ] as const) {
      box('sector-fuel-tank', x, 4, z, 10, 8, 10)
      box('fuel-pipe', x, 0.8, z - 8, 0.65, 1.6, 7)
    }
  if (id === 'chain-reaction')
    for (const [x, z] of [
      [23, 39],
      [21, 64],
    ] as const)
      box('sector-fuel-tank', x, 4, z, 8, 8, 8)
  if (id === 'sealed-cargo')
    for (const [x, z] of [
      [9, -32],
      [26, -27],
      [3, 37],
      [20, 45],
      [33, 66],
      [43, 4],
    ] as const)
      box('container', x, 1.6, z, 7, 3.2, 15)
  if (id === 'deep-cut')
    for (const [x, z] of [
      [4, 31],
      [25, -21],
      [-8, 44],
    ] as const)
      box('quarry-stone', x, 1.2, z, 6, 2.4, 5, 'concrete')
  if (id === 'market-fire' || id === 'dust-trail')
    for (const [x, z] of [
      [-12, 0],
      [15, 10],
    ] as const) {
      box('market-counter', x, 0.65, z, 6, 1.3, 2, 'wood')
      box('market-canopy', x, 2.8, z, 7, 0.2, 4, 'wood')
      for (const side of [-1, 1])
        box('market-post', x + side * 3, 1.4, z - 1.6, 0.15, 2.8, 0.15, 'wood')
    }
  if (id === 'hard-reset' || id === 'open-horizon' || id === 'long-watch')
    box('civic-fountain', center.x + 13, 0.5, center.z + 10, 7, 1, 7, 'concrete')
  if (id === 'ghost-frequency' || id === 'silent-current') {
    box('signal-mast', center.x + 12, 9, center.z + 7, 0.5, 18, 0.5)
    box('signal-array', center.x + 12, 15, center.z + 7, 7, 2, 0.4)
  }
  if (id === 'broken-wing' || id === 'last-approach') {
    const placements =
      id === 'broken-wing'
        ? [
            [22, -12],
            [37, 47],
          ]
        : [
            [15, -43],
            [17, 41],
          ]
    for (const [x, z] of placements) {
      box('aircraft-fuselage', x!, 2.5, z!, 2.4, 2.4, 14)
      box('aircraft-wing', x!, 2.4, z!, 17, 0.24, 3.3)
      box('aircraft-tailplane', x!, 3.3, z! + 5.5, 7, 0.2, 2)
      box('aircraft-tailfin', x!, 4.4, z! + 5.5, 0.22, 3, 2.5)
      for (const side of [-1, 1]) {
        box('aircraft-engine', x! + side * 3.5, 2.15, z! - 1.5, 1, 1, 3)
        box('aircraft-gear', x! + side * 1.2, 0.7, z! + 2, 0.45, 1.4, 0.9)
      }
      box('aircraft-nose-gear', x!, 0.7, z! - 4, 0.4, 1.4, 0.8)
    }
  }
  // Parks, roadside trees and parked civilian cars follow the authored streets.
  for (const patch of plan.surfaces) {
    if (patch.kind === 'grass')
      for (const side of [-1, 1])
        for (const end of [-1, 1])
          box(
            'planter',
            patch.x + side * patch.width * 0.3,
            0.2,
            patch.z + end * patch.depth * 0.3,
            1.5,
            0.4,
            1.5,
            'concrete',
          )
    if (patch.kind !== 'asphalt' || (patch.width > 18 && patch.depth > 18)) continue
    const vertical = patch.depth > patch.width,
      length = vertical ? patch.depth : patch.width
    for (let offset = -length / 2 + 13; offset < length / 2 - 5; offset += 27) {
      const x = patch.x + (vertical ? patch.width / 2 - 1.6 : offset),
        z = patch.z + (vertical ? offset : patch.depth / 2 - 1.6)
      if (
        objectives.some((p) => Math.hypot(p.x - x, p.z - z) < 9) ||
        buildings.some(
          (b) => Math.abs(x - b.x) < b.width / 2 + 3 && Math.abs(z - b.z) < b.depth / 2 + 3,
        ) ||
        solids.some(
          (s) => Math.abs(x - s.x) < s.width / 2 + 3 && Math.abs(z - s.z) < s.depth / 2 + 3,
        )
      )
        continue
      cars.push({ id: `${id}-parked-${cars.length}`, x, z, sideways: !vertical, color: '#647976' })
    }
  }
  return cars
}
