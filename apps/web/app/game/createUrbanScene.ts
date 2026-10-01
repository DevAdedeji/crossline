import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import { BUILDINGS, MAP_SOLIDS, PARKED_CARS, RAMP, ROOF_HEIGHT } from '@crossline/shared'

/** All artwork is original procedural geometry; collider meshes come from the shared map. */
export function createUrbanScene(canvas: HTMLCanvasElement) {
  const engine = new Engine(canvas, true, { stencil: true })
  engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5))
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.57, 0.66, 0.67, 1)
  scene.fogMode = Scene.FOGMODE_EXP2
  scene.fogDensity = 0.007
  scene.fogColor = new Color3(0.57, 0.66, 0.67)
  const camera = new UniversalCamera('player-camera', new Vector3(-3, 1.7, -22), scene)
  camera.minZ = 0.08; camera.maxZ = 160; camera.fov = 1.2
  camera.keysUp = []; camera.keysDown = []; camera.keysLeft = []; camera.keysRight = []
  // Input ownership stays in the game: Babylon must never move or reorient this camera.
  camera.inputs.clear(); camera.inertia = 0
  const ambient = new HemisphericLight('sky', new Vector3(0, 1, 0), scene)
  ambient.intensity = 0.7; ambient.groundColor = Color3.FromHexString('#626058')
  const sun = new DirectionalLight('afternoon-sun', new Vector3(-0.6, -1, 0.4), scene)
  sun.position.set(25, 45, -25); sun.intensity = 1.1; sun.diffuse = Color3.FromHexString('#ffe2b1')
  const shadows = new ShadowGenerator(1024, sun)
  shadows.usePercentageCloserFiltering = true; shadows.bias = 0.01; shadows.normalBias = 0.12

  const materials = new Map<string, StandardMaterial>()
  function material(name: string, color: string) {
    const existing = materials.get(name)
    if (existing) return existing
    const value = new StandardMaterial(name, scene)
    value.diffuseColor = Color3.FromHexString(color); value.specularColor = Color3.Black()
    materials.set(name, value)
    return value
  }
  const palette = {
    plaster: material('plaster', '#c9bea1'), brick: material('brick', '#985d46'),
    concrete: material('concrete', '#919b92'), roof: material('roof', '#727d76'),
    metal: material('metal', '#4d615e'), wood: material('wood', '#977a4e'),
  }
  const staticMeshes: Mesh[] = []
  function box(name: string, x: number, y: number, z: number, width: number, height: number, depth: number, surface: StandardMaterial) {
    const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene)
    mesh.position.set(x, y, z); mesh.material = surface; mesh.receiveShadows = true
    staticMeshes.push(mesh)
    return mesh
  }
  box('neighbourhood-ground', 0, -0.13, 0, 54, 0.25, 54, material('paving', '#a2a394'))
  const asphalt = material('asphalt', '#414e50')
  box('mercer-street', 0, 0.001, 0, 9, 0.012, 53, asphalt)
  box('cross-street', 0, 0.004, 0, 53, 0.014, 8, asphalt)
  const paint = material('road-paint', '#d7ceaa')
  const curb = material('curb', '#d1ccba')
  // Flat paving/paint are decorative; no hidden sidewalk collision steps.
  for (let i = -24; i <= 24; i += 4) {
    if (Math.abs(i) > 5) box('street-dash', 0, 0.02, i, 0.1, 0.02, 1.8, paint)
    for (const x of [-4.6, 4.6]) box('curb-inlay', x, 0.02, i, 0.24, 0.03, 3.8, curb)
  }
  for (let x = -3.6; x <= 3.7; x += 1.2) for (const z of [-5.1, 5.1]) box('crosswalk', x, 0.025, z, 0.65, 0.015, 1.5, paint)
  for (const solid of MAP_SOLIDS) box(solid.id, solid.x, solid.y, solid.z, solid.width, solid.height, solid.depth, palette[solid.material])

  // Solid sloped wedge uses exactly the authoritative ramp's extent and height.
  const { minX: a, maxX: b, minZ: c, maxZ: d, height: h } = RAMP
  const ramp = new Mesh('west-rooftop-ramp', scene)
  const vertices = new VertexData()
  vertices.positions = [a, 0, c, b, 0, c, a, h, d, b, h, d, a, 0, d, b, 0, d]
  vertices.uvs = [0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0]
  vertices.indices = [0, 2, 1, 1, 2, 3, 0, 4, 2, 1, 3, 5, 2, 4, 3, 3, 4, 5, 0, 1, 4, 1, 5, 4]
  const normals: number[] = []; VertexData.ComputeNormals(vertices.positions, vertices.indices, normals); vertices.normals = normals
  vertices.applyToMesh(ramp); ramp.material = palette.metal; ramp.receiveShadows = true; staticMeshes.push(ramp)
  for (let z = c + 0.5; z < d; z += 0.8) {
    const tread = box('ramp-grip-strip', (a + b) / 2, (z - c) / (d - c) * h + 0.015, z, b - a, 0.025, 0.06, paint)
    tread.rotation.x = -Math.atan(h / (d - c))
  }

  const glass = material('window-glass', '#325f6a')
  glass.specularColor = Color3.FromHexString('#9fbab4'); glass.specularPower = 64
  const frame = material('window-frames', '#d4cfb5')
  for (const building of BUILDINGS) {
    // All windows remain visibly glazed; only the marked door openings are traversable.
    for (const side of [-1, 1]) {
      for (const offset of [-3.5, 3.5]) {
        box('window-frame', building.x + side * (building.width / 2 + 0.22), 2.05, building.z + offset, 0.08, 1.45, 1.6, frame)
        box('window', building.x + side * (building.width / 2 + 0.27), 2.05, building.z + offset, 0.02, 1.22, 1.35, glass)
      }
      for (const offset of [-4, 4]) {
        box('window-frame', building.x + offset, 2.05, building.z + side * (building.depth / 2 + 0.22), 1.6, 1.45, 0.08, frame)
        box('window', building.x + offset, 2.05, building.z + side * (building.depth / 2 + 0.27), 1.35, 1.22, 0.02, glass)
      }
    }
    const doorSide = building.doors[0] === 'east' ? 1 : -1
    sign(building.name, building.x + doorSide * (building.width / 2 + 0.23), 3.3, building.z, -doorSide * Math.PI / 2, 4.6, 0.7)
    // Floor inset and contrasting entrance threshold help read the interiors.
    box('interior-tile', building.x, 0.015, building.z, building.width - 0.45, 0.02, building.depth - 0.45, material('interior-floor', '#b9b09a'))
    box('entrance-threshold', building.x + doorSide * building.width / 2, 0.025, building.z, 0.7, 0.03, 2.3, paint)
  }

  const rubber = material('rubber', '#252c2a')
  const chrome = material('car-trim', '#bac3b7')
  for (const car of PARKED_CARS) {
    const body = material(car.id + '-paint', car.color)
    const local = (name: string, x: number, y: number, z: number, w: number, height: number, depth: number, surface: StandardMaterial) => box(name, car.x + (car.sideways ? z : x), y, car.z + (car.sideways ? -x : z), car.sideways ? depth : w, height, car.sideways ? w : depth, surface)
    local('car-body', 0, 0.6, 0, 2, 0.68, 4.5, body)
    local('car-cabin', 0, 1.12, -0.1, 1.72, 0.87, 2.2, body)
    local('windshield', 0, 1.23, 1.015, 1.5, 0.5, 0.03, glass)
    local('rear-glass', 0, 1.23, -1.215, 1.5, 0.5, 0.03, glass)
    for (const side of [-1, 1]) {
      local('side-glass', side * 0.871, 1.22, -0.1, 0.025, 0.46, 1.85, glass)
      local('window-pillar', side * 0.887, 1.22, -0.1, 0.035, 0.5, 0.12, body)
      for (const z of [-1.4, 1.4]) {
        const wheel = MeshBuilder.CreateCylinder('wheel', { diameter: 0.68, height: 0.15, tessellation: 12 }, scene)
        wheel.rotation.z = Math.PI / 2; if (car.sideways) wheel.rotation.y = Math.PI / 2
        wheel.position.set(car.x + (car.sideways ? z : side * 0.96), 0.35, car.z + (car.sideways ? -side * 0.96 : z))
        wheel.material = rubber; wheel.receiveShadows = true; staticMeshes.push(wheel)
      }
    }
    local('front-bumper', 0, 0.38, 2.26, 1.85, 0.16, 0.07, chrome)
    local('back-bumper', 0, 0.38, -2.26, 1.85, 0.16, 0.07, chrome)
    for (const x of [-0.65, 0.65]) {
      local('headlamp', x, 0.71, 2.263, 0.4, 0.22, 0.025, paint)
      local('tail-lamp', x, 0.71, -2.263, 0.4, 0.22, 0.025, material('tail-lamps', '#af493e'))
    }
    // Parking bay lines remain flat and non-colliding.
    for (const side of [-1, 1]) local('parking-bay', side * 1.35, 0.027, 0, 0.06, 0.02, 5.2, paint)
  }

  const foliage = material('foliage', '#536d50')
  for (const solid of MAP_SOLIDS.filter((value) => value.id.startsWith('planter'))) {
    box('tree-trunk', solid.x, 1.8, solid.z, 0.3, 2.4, 0.3, palette.wood)
    const crown = MeshBuilder.CreateSphere('tree-canopy', { diameter: 3, segments: 4 }, scene)
    crown.position.set(solid.x, 3.5, solid.z); crown.scaling.y = 1.3; crown.material = foliage; staticMeshes.push(crown)
  }
  for (const solid of MAP_SOLIDS.filter((value) => value.id.startsWith('lamp'))) {
    box('lamp-arm', solid.x + 0.45, 4.55, solid.z, 1, 0.12, 0.12, palette.metal)
    box('lamp-head', solid.x + 0.9, 4.5, solid.z, 0.45, 0.15, 0.65, paint)
  }
  // Unreachable skyline gives the small block context without adding traversable world size.
  const skyline = material('skyline', '#687d7b')
  for (let i = 0; i < 12; i++) {
    const x = -39 + (i % 6) * 15
    const z = i < 6 ? 39 : -39
    const height = 9 + (i * 7 % 12)
    box('distant-building', x, height / 2, z, 10, height, 8, skyline)
  }
  sign('ROOF ACCESS  /  ↑', -20, 1.2, 5, 0, 2.4, 0.55)
  sign('MERCER BLOCK', 0, 3, 26.35, 0, 6, 0.9)
  sign('LOADING / 03', 21, 1.8, -15, -Math.PI / 2, 3, 0.8)

  function sign(text: string, x: number, y: number, z: number, yaw: number, width: number, height: number) {
    const texture = new DynamicTexture(text, { width: 1024, height: 256 }, scene, false)
    texture.drawText(text, null, 155, 'bold 66px sans-serif', '#dcecba', '#243c35', true)
    const surface = new StandardMaterial(text, scene)
    surface.diffuseTexture = texture; surface.emissiveColor = new Color3(0.25, 0.25, 0.25); surface.specularColor = Color3.Black(); surface.backFaceCulling = false
    const plane = MeshBuilder.CreatePlane(text, { width, height }, scene)
    plane.position.set(x, y, z); plane.rotation.y = yaw; plane.material = surface
    plane.freezeWorldMatrix(); surface.freeze()
  }
  // Batch immutable geometry by material. Rendering never performs gameplay collision.
  const groups = new Map<StandardMaterial, Mesh[]>()
  for (const mesh of staticMeshes) {
    const surface = mesh.material as StandardMaterial
    const group = groups.get(surface) ?? []; group.push(mesh); groups.set(surface, group)
  }
  for (const group of groups.values()) {
    const merged = Mesh.MergeMeshes(group, true, true)
    if (merged) {
      merged.receiveShadows = true; merged.freezeWorldMatrix()
      const surface = merged.material as StandardMaterial
      if (![asphalt, skyline, paint, curb, materials.get('paving'), materials.get('interior-floor')].includes(surface)) shadows.addShadowCaster(merged)
    }
  }
  for (const surface of materials.values()) surface.freeze()
  const avatarMaterial = material('players', '#d9f99b')
  return { engine, scene, camera, avatarMaterial, roofHeight: ROOF_HEIGHT }
}
