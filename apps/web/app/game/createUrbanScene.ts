import { addFacades } from './urbanFacades'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { ReflectionProbe } from '@babylonjs/core/Probes/reflectionProbe'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { surfaceTexture } from './surfaceTexture'
import type { TrainingAssets } from './trainingAssets'
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

/** Shared collider geometry with locally licensed facade and surface artwork. */
export function createUrbanScene(canvas: HTMLCanvasElement) {
  const engine = new Engine(canvas, true, { stencil: true })
  engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5))
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.57, 0.66, 0.67, 1)
  scene.fogMode = Scene.FOGMODE_EXP2
  scene.fogDensity = 0.007
  scene.fogColor = new Color3(0.57, 0.66, 0.67)
  const camera = new UniversalCamera('player-camera', new Vector3(-3, 1.7, -22), scene)
  camera.minZ = 0.12
  camera.maxZ = 160
  camera.fov = 1.2
  camera.keysUp = []
  camera.keysDown = []
  camera.keysLeft = []
  camera.keysRight = []
  // Input ownership stays in the game: Babylon must never move or reorient this camera.
  camera.inputs.clear()
  camera.inertia = 0
  const ambient = new HemisphericLight('sky', new Vector3(0, 1, 0), scene)
  ambient.intensity = 0.7
  ambient.groundColor = Color3.FromHexString('#626058')
  const sun = new DirectionalLight('afternoon-sun', new Vector3(-0.6, -1, 0.4), scene)
  sun.position.set(25, 45, -25)
  sun.intensity = 0.9
  sun.diffuse = Color3.FromHexString('#ffe2b1')
  sun.autoUpdateExtends = false
  sun.orthoLeft = -38
  sun.orthoRight = 38
  sun.orthoTop = 38
  sun.orthoBottom = -38
  sun.shadowMinZ = 1
  sun.shadowMaxZ = 110
  const shadows = new ShadowGenerator(2048, sun)
  shadows.usePercentageCloserFiltering = true
  shadows.bias = 0.01
  shadows.normalBias = 0.12

  const materials = new Map<string, StandardMaterial>()
  function material(name: string, color: string) {
    const existing = materials.get(name)
    if (existing) return existing
    const value = new StandardMaterial(name, scene)
    value.diffuseColor = Color3.FromHexString(color)
    value.specularColor = Color3.Black()
    const photo =
      name === 'brick'
        ? 'brick'
        : name === 'asphalt'
          ? 'asphalt'
          : ['plaster', 'concrete', 'roof', 'paving'].includes(name)
            ? 'concrete'
            : null
    if (photo) {
      value.diffuseTexture = new Texture(
        `/textures/${photo}-color.jpg`,
        scene,
        false,
        false,
        Texture.TRILINEAR_SAMPLINGMODE,
      )
      value.bumpTexture = new Texture(
        `/textures/${photo}-normal.jpg`,
        scene,
        false,
        false,
        Texture.TRILINEAR_SAMPLINGMODE,
      )
      value.diffuseTexture.anisotropicFilteringLevel = 8
      value.bumpTexture.anisotropicFilteringLevel = 8
      value.bumpTexture.level = photo === 'asphalt' ? 0.2 : 0.45
      if (photo === 'brick') value.diffuseColor = new Color3(0.88, 0.88, 0.88)
      if (photo === 'asphalt') value.diffuseColor = new Color3(0.72, 0.74, 0.75)
    } else if (['wood', 'interior-floor'].includes(name))
      value.diffuseTexture = surfaceTexture(name, scene)
    materials.set(name, value)
    return value
  }
  const palette = {
    plaster: material('plaster', '#c9bea1'),
    brick: material('brick', '#985d46'),
    concrete: material('concrete', '#919b92'),
    roof: material('roof', '#727d76'),
    metal: material('metal', '#4d615e'),
    wood: material('wood', '#977a4e'),
  }
  const staticMeshes: Mesh[] = []
  function box(
    name: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    surface: StandardMaterial,
  ) {
    const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene)
    if (surface.diffuseTexture) {
      const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!,
        normals = mesh.getVerticesData(VertexBuffer.NormalKind)!,
        uvs: number[] = []
      for (let i = 0; i < positions.length; i += 3) {
        const horizontal = Math.abs(normals[i + 1]!) > 0.5
        uvs.push(
          (Math.abs(normals[i]!) > 0.5 ? positions[i + 2]! + z : positions[i]! + x) / 2,
          (horizontal ? positions[i + 2]! + z : positions[i + 1]! + y) / 2,
        )
      }
      mesh.setVerticesData(VertexBuffer.UVKind, uvs)
    }
    mesh.position.set(x, y, z)
    mesh.material = surface
    mesh.receiveShadows = true
    staticMeshes.push(mesh)
    return mesh
  }
  box('neighbourhood-ground', 0, -0.13, 0, 54, 0.25, 54, material('paving', '#91988e'))
  const asphalt = material('asphalt', '#414e50')
  box('mercer-south', 0, 0.003, -15.25, 9, 0.014, 22.5, asphalt)
  box('mercer-north', 0, 0.003, 15.25, 9, 0.014, 22.5, asphalt)
  box('cross-street', 0, 0.004, 0, 53, 0.014, 8, asphalt)
  const paint = material('road-paint', '#d7ceaa')
  const curb = material('curb', '#d1ccba')
  // Flat paving/paint are decorative; no hidden sidewalk collision steps.
  for (let i = -24; i <= 24; i += 4) {
    if (Math.abs(i) > 5) box('street-dash', 0, 0.02, i, 0.1, 0.02, 1.8, paint)
    for (const x of [-4.6, 4.6]) box('curb-inlay', x, 0.02, i, 0.24, 0.03, 3.8, curb)
  }
  for (let x = -3.6; x <= 3.7; x += 1.2)
    for (const z of [-5.1, 5.1]) box('crosswalk', x, 0.025, z, 0.65, 0.015, 1.5, paint)
  for (const solid of MAP_SOLIDS)
    box(
      solid.id,
      solid.x,
      solid.y,
      solid.z,
      solid.width,
      solid.height,
      solid.depth,
      palette[solid.material],
    )

  // Solid sloped wedge uses exactly the authoritative ramp's extent and height.
  const { minX: a, maxX: b, minZ: c, maxZ: d, height: h } = RAMP
  const ramp = new Mesh('west-rooftop-ramp', scene)
  const vertices = new VertexData()
  vertices.positions = [a, 0, c, b, 0, c, a, h, d, b, h, d, a, 0, d, b, 0, d]
  vertices.uvs = [0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0]
  vertices.indices = [0, 2, 1, 1, 2, 3, 0, 4, 2, 1, 3, 5, 2, 4, 3, 3, 4, 5, 0, 1, 4, 1, 5, 4]
  const normals: number[] = []
  VertexData.ComputeNormals(vertices.positions, vertices.indices, normals)
  vertices.normals = normals
  vertices.applyToMesh(ramp)
  ramp.material = palette.metal
  ramp.receiveShadows = true
  staticMeshes.push(ramp)
  for (let z = c + 0.5; z < d; z += 0.8) {
    const tread = box(
      'ramp-grip-strip',
      (a + b) / 2,
      ((z - c) / (d - c)) * h + 0.015,
      z,
      b - a,
      0.025,
      0.06,
      paint,
    )
    tread.rotation.x = -Math.atan(h / (d - c))
  }

  const glass = material('window-glass', '#325f6a')
  glass.specularColor = Color3.FromHexString('#9fbab4')
  glass.specularPower = 64
  for (const building of BUILDINGS) {
    const doorSide = building.doors[0] === 'east' ? 1 : -1
    sign(
      building.name,
      building.x + doorSide * (building.width / 2 + 0.23),
      3.3,
      building.z,
      (-doorSide * Math.PI) / 2,
      4.6,
      0.7,
    )
    // Floor inset and contrasting entrance threshold help read the interiors.
    box(
      'interior-tile',
      building.x,
      0.015,
      building.z,
      building.width - 0.45,
      0.02,
      building.depth - 0.45,
      material('interior-floor', '#b9b09a'),
    )
    box(
      'entrance-threshold',
      building.x + (doorSide * building.width) / 2,
      0.025,
      building.z,
      0.7,
      0.03,
      2.3,
      paint,
    )
  }

  // Cars are game-ready meshes, fitted to the existing conservative authoritative colliders.
  function addVehicles(assets: TrainingAssets) {
    addFacades(scene, assets, shadows)
    const reflection = new ReflectionProbe('street reflection', 128, scene)
    reflection.position.set(0, 2, 0)
    scene.environmentTexture = reflection.cubeTexture
    reflection.renderList = scene.meshes.filter((mesh) => mesh.getTotalVertices() > 0)
    reflection.refreshRate = 0
    glass.unfreeze()
    glass.reflectionTexture = reflection.cubeTexture
    glass.reflectionTexture.level = 0.45
    glass.diffuseColor = Color3.FromHexString('#36434a')
    glass.freeze()

    for (const car of PARKED_CARS) {
      const root = new TransformNode(car.id, scene)
      const instance = assets.sedan.instantiateModelsToScene((n) => `${car.id}-${n}`, true, {
        doNotInstantiate: true,
      })
      for (const node of instance.rootNodes) {
        node.parent = root
        ;(node as TransformNode).scaling.set(2 / 1.80736, 1.56 / 1.18261, 4.5 / 4.22072)
      }
      root.position.set(car.x, 0, car.z)
      root.rotation.y = car.sideways ? Math.PI / 2 : 0
      for (const mesh of root.getChildMeshes()) {
        mesh.receiveShadows = true
        shadows.addShadowCaster(mesh)
        const surface = mesh.material
        if (surface instanceof PBRMaterial) {
          surface.roughness = surface.name.includes('Windows') ? 0.12 : 0.4
          surface.reflectionTexture = reflection.cubeTexture
          surface.environmentIntensity = 0.65
          surface.metallic = surface.name.includes('Blue')
            ? 0.45
            : surface.name.includes('Windows')
              ? 0.7
              : 0.05
          if (surface.name.includes('Blue')) surface.albedoColor = Color3.FromHexString(car.color)
        }
      }
    }
  }

  const foliage = material('foliage', '#536d50')
  for (const solid of MAP_SOLIDS.filter((value) => value.id.startsWith('planter'))) {
    box('tree-trunk', solid.x, 1.8, solid.z, 0.3, 2.4, 0.3, palette.wood)
    const crown = MeshBuilder.CreateSphere('tree-canopy', { diameter: 3, segments: 4 }, scene)
    crown.position.set(solid.x, 3.5, solid.z)
    crown.scaling.y = 1.3
    crown.material = foliage
    staticMeshes.push(crown)
  }
  for (const solid of MAP_SOLIDS.filter((value) => value.id.startsWith('lamp'))) {
    box('lamp-arm', solid.x + 0.45, 4.55, solid.z, 1, 0.12, 0.12, palette.metal)
    box('lamp-head', solid.x + 0.9, 4.5, solid.z, 0.45, 0.15, 0.65, paint)
  }
  // Unreachable skyline gives the small block context without adding traversable world size.
  const skyline = material('skyline', '#687d7b')
  sign('ROOF ACCESS  /  ↑', -20, 1.2, 5, 0, 2.4, 0.55)
  sign('MERCER BLOCK', 0, 3, 26.35, 0, 6, 0.9)
  sign('LOADING / 03', 21, 1.8, -15, -Math.PI / 2, 3, 0.8)

  function sign(
    text: string,
    x: number,
    y: number,
    z: number,
    yaw: number,
    width: number,
    height: number,
  ) {
    const texture = new DynamicTexture(text, { width: 1024, height: 256 }, scene, false)
    texture.drawText(text, null, 155, 'bold 66px sans-serif', '#dcecba', '#243c35', true)
    const surface = new StandardMaterial(text, scene)
    surface.diffuseTexture = texture
    surface.emissiveColor = new Color3(0.25, 0.25, 0.25)
    surface.specularColor = Color3.Black()
    surface.backFaceCulling = false
    const plane = MeshBuilder.CreatePlane(text, { width, height }, scene)
    plane.position.set(x, y, z)
    plane.rotation.y = yaw
    plane.material = surface
    plane.freezeWorldMatrix()
    surface.freeze()
  }
  // Batch immutable geometry by material. Rendering never performs gameplay collision.
  const groups = new Map<StandardMaterial, Mesh[]>()
  for (const mesh of staticMeshes) {
    const surface = mesh.material as StandardMaterial
    const group = groups.get(surface) ?? []
    group.push(mesh)
    groups.set(surface, group)
  }
  for (const group of groups.values()) {
    const merged = Mesh.MergeMeshes(group, true, true)
    if (merged) {
      merged.receiveShadows = true
      merged.freezeWorldMatrix()
      const surface = merged.material as StandardMaterial
      if (
        ![
          asphalt,
          skyline,
          paint,
          curb,
          materials.get('paving'),
          materials.get('interior-floor'),
        ].includes(surface)
      )
        shadows.addShadowCaster(merged)
    }
  }
  for (const surface of materials.values()) surface.freeze()
  const avatarMaterial = material('players', '#d9f99b')
  return { engine, scene, camera, shadows, avatarMaterial, addVehicles, roofHeight: ROOF_HEIGHT }
}
