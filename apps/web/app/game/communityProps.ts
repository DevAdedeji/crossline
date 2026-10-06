import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import type { Scene } from '@babylonjs/core/scene'
import type { Solid, WorldGeometry } from '@crossline/shared'
type Box = (
  name: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  surface: PBRMaterial,
) => Mesh
type Material = (name: string, color: string) => PBRMaterial
export const communitySolid = (s: Solid) =>
  /^(home-|clinic-bed|public-seating|ticket-counter|shop-counter|baggage-carousel|civic-fountain|quarry-stone|rubble)/.test(
    s.id,
  )
export function communityProps(
  scene: Scene,
  world: WorldGeometry,
  box: Box,
  material: Material,
  meshes: Mesh[],
) {
  const timber = material('wood', '#977a4e'),
    metal = material('community metal', '#46514f'),
    linen = material('household linen', '#9a9c87'),
    seat = material('household upholstery', '#6c7b69'),
    stone = material('concrete', '#aaa392')
  const dark = material('carousel rubber', '#313934'),
    water = material('fountain water', '#437983')
  for (const s of world.solids) {
    if (!communitySolid(s)) continue
    const { x, y, z, width: w, height: h, depth: d, id } = s
    if (id.startsWith('civic-fountain')) {
      const basin = MeshBuilder.CreateCylinder(
        'public fountain basin',
        { diameter: w, height: h, tessellation: 16 },
        scene,
      )
      basin.position.set(x, y, z)
      basin.material = stone
      meshes.push(basin)
      const pool = MeshBuilder.CreateCylinder(
        'fountain pool',
        { diameter: w - 0.6, height: 0.04, tessellation: 24 },
        scene,
      )
      pool.position.set(x, h + 0.02, z)
      pool.material = water
      meshes.push(pool)
      const sculpture = MeshBuilder.CreateCylinder(
        'fountain column',
        { diameterBottom: 0.9, diameterTop: 0.55, height: 2.5, tessellation: 12 },
        scene,
      )
      sculpture.position.set(x, h + 1.25, z)
      sculpture.material = stone
      meshes.push(sculpture)
    } else if (id.startsWith('quarry-stone') || id.startsWith('rubble')) {
      const rock = MeshBuilder.CreatePolyhedron('broken masonry', { type: 1, size: 1 }, scene)
      rock.scaling.set(w / 2, h / 2, d / 2)
      rock.position.set(x, y, z)
      rock.material = stone
      meshes.push(rock)
    } else if (id.startsWith('baggage-carousel')) {
      box('carousel base', x, y * 0.6, z, w, h * 0.6, d, metal)
      box('baggage belt', x, h - 0.1, z, w, 0.2, d, dark)
      for (const side of [-1, 1])
        box('luggage case', x + side * w * 0.28, h + 0.25, z, 0.6, 0.5, 0.45, timber)
    } else if (
      id.startsWith('home-table') ||
      id.startsWith('ticket-counter') ||
      id.startsWith('shop-counter')
    ) {
      box('table surface', x, h - 0.09, z, w, 0.18, d, timber)
      for (const side of [-1, 1])
        for (const end of [-1, 1])
          box(
            'table leg',
            x + side * (w / 2 - 0.13),
            h / 2,
            z + end * (d / 2 - 0.13),
            0.12,
            h,
            0.12,
            metal,
          )
      if (id.startsWith('home-table'))
        box('dining chair', x, 0.42, z + d / 2 + 0.35, 0.5, 0.84, 0.5, seat)
    } else if (id.startsWith('home-bed') || id.startsWith('clinic-bed')) {
      box('bed frame', x, h * 0.45, z, w, h * 0.6, d, timber)
      box('mattress', x, h - 0.1, z, w - 0.1, 0.2, d - 0.1, linen)
      box('pillow', x, h + 0.06, z + d * 0.3, w * 0.7, 0.13, d * 0.2, linen)
      box('bedhead', x, h * 0.8, z + d / 2 - 0.05, w, h, 0.1, timber)
    } else {
      box('seat cushion', x, h * 0.45, z, w, 0.22, d, seat)
      box('seat back', x, h * 0.75, z + d / 2 - 0.1, w, h * 0.5, 0.2, seat)
      for (const side of [-1, 1])
        box('seat leg', x + side * (w / 2 - 0.2), h * 0.18, z, 0.15, h * 0.36, d * 0.8, metal)
    }
  }
}
