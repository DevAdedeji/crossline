import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { Scene } from '@babylonjs/core/scene'
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
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
export const detailedCampaignSolid = (s: Solid) =>
  /^(aircraft-fuselage-|tower-observation-cabin|sector-fuel-tank-|field-tent-)/.test(s.id)

/** Recognizable props use the shared cover footprints; detail is batched with the arena. */
export function campaignStructures(
  scene: Scene,
  world: WorldGeometry,
  box: Box,
  material: Material,
  meshes: Mesh[],
) {
  if (world.legacyRamp !== false) return
  const steel = material('equipment steel', '#37484b'),
    trim = material('equipment trim', '#a8aba0'),
    rubber = material('equipment rubber', '#202629')
  const yellow = material('equipment caution', '#c49b41'),
    wood = material('wood', '#977a4e'),
    glass = material('cockpit glazing', '#203d4b')
  glass.metallic = 0.45
  glass.roughness = 0.22
  const aircraft = material('aircraft paint', '#bec5bd'),
    red = material('equipment red', '#9c4935')
  function cylinder(
    name: string,
    x: number,
    y: number,
    z: number,
    diameter: number,
    height: number,
    surface: PBRMaterial,
    rotation = 0,
    top = diameter,
    bottom = diameter,
  ) {
    const mesh = MeshBuilder.CreateCylinder(
      name,
      { diameterTop: top, diameterBottom: bottom, height, tessellation: 16 },
      scene,
    )
    mesh.position.set(x, y, z)
    mesh.rotation.x = rotation
    mesh.material = surface
    meshes.push(mesh)
    return mesh
  }
  for (const s of world.solids) {
    const { id, x, y, z, width: w, height: h, depth: d } = s
    if (id.startsWith('sector-fuel-tank-')) {
      const tank = cylinder('fuel storage tank', x, y, z, w, h, trim)
      tank.scaling.z = d / w
      for (const level of [-1, 1]) {
        const band = MeshBuilder.CreateTorus(
          'tank steel band',
          { diameter: w, thickness: 0.1, tessellation: 24 },
          scene,
        )
        band.position.set(x, y + level * h * 0.32, z)
        band.scaling.z = d / w
        band.material = steel
        meshes.push(band)
      }
      cylinder('tank service cap', x, y + h / 2 + 0.12, z, 0.8, 0.24, steel)
    } else if (id.startsWith('field-tent-')) {
      const canvas = material('tent canvas', '#a79776'),
        eave = h * 0.65
      canvas.backFaceCulling = false
      box('canvas tent walls', x, eave / 2, z, w, eave, d, canvas)
      const roof = new Mesh('pitched canvas roof', scene),
        data = new VertexData()
      data.positions = [
        -w / 2,
        eave,
        -d / 2,
        w / 2,
        eave,
        -d / 2,
        0,
        h,
        -d / 2,
        -w / 2,
        eave,
        d / 2,
        w / 2,
        eave,
        d / 2,
        0,
        h,
        d / 2,
      ]
      data.uvs = [0, 0, 1, 0, 0.5, 1, 0, 0, 1, 0, 0.5, 1]
      data.indices = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4]
      data.normals = []
      VertexData.ComputeNormals(data.positions, data.indices, data.normals)
      data.applyToMesh(roof)
      roof.position.set(x, 0, z)
      roof.material = canvas
      meshes.push(roof)
      box('tent entrance flap', x, eave * 0.46, z - d / 2 - 0.025, w * 0.3, eave * 0.9, 0.04, steel)
    } else if (id.startsWith('aircraft-fuselage-')) {
      cylinder('aircraft fuselage', x, y, z, 2.4, 11, aircraft, Math.PI / 2)
      cylinder('aircraft nose', x, y, z - 6.25, 2.4, 1.5, aircraft, Math.PI / 2, 2.4, 0)
      cylinder('aircraft tail cone', x, y, z + 6.25, 2.4, 1.5, aircraft, Math.PI / 2, 0, 2.4)
      const canopy = MeshBuilder.CreateSphere(
        'aircraft cockpit',
        { diameter: 1, segments: 12 },
        scene,
      )
      canopy.scaling.set(1.8, 1.1, 2.5)
      canopy.position.set(x, y + 0.7, z - 3.9)
      canopy.material = glass
      meshes.push(canopy)
      for (const side of [-1, 1]) {
        box('wing insignia', x + side * 5, 2.535, z, 1.4, 0.025, 0.45, red)
        for (let window = -1; window <= 3; window += 1)
          box(
            'aircraft cabin window',
            x + side * 1.19,
            y + 0.25,
            z + window,
            0.025,
            0.35,
            0.45,
            glass,
          )
      }
    } else if (id.startsWith('aircraft-engine-')) {
      cylinder('aircraft engine', x, y, z, w, d, steel, Math.PI / 2)
      cylinder('engine intake', x, y, z - d / 2 - 0.01, w * 0.82, 0.03, rubber, Math.PI / 2)
    } else if (id.startsWith('tower-observation-cabin')) {
      box('tower cabin floor', x, y - h / 2 + 0.15, z, w, 0.3, d, trim)
      box('tower cabin ceiling', x, y + h / 2 - 0.15, z, w, 0.3, d, trim)
      for (const side of [-1, 1]) {
        box('tower glazing', x, y, z + (side * d) / 2, w, h - 0.6, 0.08, glass)
        box('tower glazing', x + (side * w) / 2, y, z, 0.08, h - 0.6, d, glass)
        for (let offset = -w / 2; offset <= w / 2; offset += 2.6)
          box('tower mullion', x + offset, y, z + (side * d) / 2, 0.12, h, 0.12, steel)
        for (let offset = -d / 2; offset <= d / 2; offset += 2.2)
          box('tower mullion', x + (side * w) / 2, y, z + offset, 0.12, h, 0.12, steel)
      }
    } else if (id.startsWith('aircraft-gear-') || id.startsWith('aircraft-nose-gear-')) {
      const wheel = cylinder('landing wheel', x, 0.35, z, 0.65, w + 0.04, rubber)
      wheel.rotation.z = Math.PI / 2
    } else if (/supply-crate|loading-crates|freight-crates/.test(id)) {
      for (const side of [-1, 1]) {
        box('crate slat', x + side * (w / 2 - 0.12), y, z - d / 2 - 0.03, 0.16, h, 0.07, wood)
        for (const level of [-1, 1])
          box(
            'crate cross brace',
            x,
            y + level * (h / 2 - 0.12),
            z + side * (d / 2 + 0.02),
            w,
            0.15,
            0.07,
            wood,
          )
      }
    } else if (id.startsWith('jersey-barrier-')) {
      for (let offset = -w / 2 + 0.25; offset < w / 2; offset += 0.6)
        for (const side of [-1, 1])
          box(
            'barrier hazard marking',
            x + offset,
            y + 0.14,
            z + side * (d / 2 + 0.012),
            0.25,
            0.2,
            0.025,
            yellow,
          )
      for (const side of [-1, 1])
        box('barrier foot', x + side * (w / 2 - 0.35), 0.12, z, 0.55, 0.24, d + 0.08, trim)
    } else if (
      id.startsWith('equipment-cabinet-') ||
      id.startsWith('signal-console-') ||
      id.startsWith('transformer-')
    ) {
      for (let level = -h / 2 + 0.25; level < h / 2 - 0.3; level += 0.22)
        box(
          'equipment cooling vent',
          x,
          y + level,
          z - d / 2 - 0.015,
          w * 0.7,
          0.055,
          0.035,
          rubber,
        )
      box('equipment warning label', x, y + h * 0.25, z - d / 2 - 0.04, 0.3, 0.2, 0.03, yellow)
      if (id.startsWith('transformer'))
        for (const side of [-1, 1])
          for (let n = -2; n <= 2; n++)
            cylinder(
              'transformer insulator',
              x + side * w * 0.3,
              y + h / 2 + 0.24,
              z + n * 0.8,
              0.18,
              0.45,
              trim,
            )
    } else if (id.startsWith('market-canopy-')) {
      for (let stripe = -w / 2 + 0.3; stripe < w / 2; stripe += 1.2)
        box('market awning stripe', x + stripe, y + h / 2 + 0.015, z, 0.55, 0.025, d, trim)
    } else if (id.startsWith('factory-machine-')) {
      box('machine worktable', x, y - 0.3, z - d / 2 - 0.1, w, 0.16, 0.2, trim)
      box('machine operator screen', x, y + 0.55, z - d / 2 - 0.03, 0.55, 0.45, 0.06, glass)
      for (const side of [-1, 1])
        box('machine support', x + side * (w / 2 - 0.25), y, z - d / 2 - 0.02, 0.2, h, 0.1, yellow)
    } else if (id.startsWith('factory-conveyor-')) {
      for (let offset = -d / 2 + 0.15; offset < d / 2; offset += 0.3) {
        const roller = cylinder('conveyor roller', x, y + h / 2 + 0.04, z + offset, 0.14, w, trim)
        roller.rotation.z = Math.PI / 2
      }
    } else if (id.startsWith('factory-stack-') || id.startsWith('forge-chimney-')) {
      for (const level of [-1, 1])
        box('chimney band', x, y + level * h * 0.27, z, w + 0.04, 0.5, d + 0.04, red)
      box('chimney mouth', x, y + h / 2 + 0.015, z, w * 0.7, 0.035, d * 0.7, rubber)
    }
  }
  for (const b of world.buildings) {
    if (world.environment !== 'industrial' && world.environment !== 'airfield') continue
    if (b.architecture && b.architecture !== 'hall' && b.architecture !== 'hangar') continue
    const height = b.height ?? 8
    // Corrugated walls, roof ribs and exposed portal frames read as work halls, not houses.
    for (const side of [-1, 1]) {
      for (let offset = -b.width / 2 + 0.4; offset < b.width / 2; offset += 0.8) {
        if (Math.abs(offset) > (b.doorWidth ?? 3) / 2 + 0.2)
          box(
            'hall cladding rib',
            b.x + offset,
            height / 2,
            b.z + side * (b.depth / 2 + 0.03),
            0.05,
            height,
            0.07,
            steel,
          )
        box('hall roof rib', b.x + offset, height + 0.34, b.z, 0.07, 0.1, b.depth, trim)
      }
      box(
        'hall portal beam',
        b.x,
        height - 0.25,
        b.z + side * (b.depth / 2 - 0.1),
        b.width,
        0.4,
        0.4,
        steel,
      )
      for (const edge of [-1, 1])
        box(
          'hall portal upright',
          b.x + edge * ((b.doorWidth ?? 3) / 2 + 0.25),
          height / 2,
          b.z + side * (b.depth / 2 - 0.1),
          0.3,
          height,
          0.4,
          steel,
        )
    }
    if (world.environment === 'industrial')
      for (const side of [-1, 1]) {
        cylinder(
          'factory overhead pipe',
          b.x + side * (b.width / 2 - 1),
          height - 1,
          b.z,
          0.3,
          b.depth - 1,
          steel,
          Math.PI / 2,
        )
        cylinder(
          'factory pipe riser',
          b.x + side * (b.width / 2 - 1),
          (height - 1) / 2,
          b.z + b.depth / 2 - 1,
          0.3,
          height - 1,
          steel,
        )
      }
    for (let row = -b.depth / 2 + 3; row < b.depth / 2; row += 4) {
      box('hall ceiling beam', b.x, height - 0.3, b.z + row, b.width, 0.3, 0.25, steel)
      box('hall roof skylight', b.x, height + 0.32, b.z + row, b.width * 0.45, 0.035, 1.4, glass)
    }
  }
}
