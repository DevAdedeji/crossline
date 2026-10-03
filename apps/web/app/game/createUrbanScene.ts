import { interiorDetails, detailedFurniture } from './interiorDetails'
import { solidTopSurfaces, type SurfaceRect } from './solidSurfaces'
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
import { TRAINING_WORLD, COMBAT_DISTRICTS, type WorldGeometry, RAMP, ROOF_HEIGHT } from '@crossline/shared'

/** Shared collider geometry with locally licensed facade and surface artwork. */
export function createUrbanScene(canvas: HTMLCanvasElement, world: WorldGeometry = TRAINING_WORLD, options: {mobile?:boolean} = {}) {
  const BUILDINGS = world.buildings, MAP_SOLIDS = world.solids, PARKED_CARS = world.cars
  const engine = new Engine(canvas, true, { stencil: true })
  engine.setHardwareScalingLevel(options.mobile ? 1 / Math.min(window.devicePixelRatio || 1, 1.5) : Math.max(1, window.devicePixelRatio / 1.5))
  const scene = new Scene(engine)
  scene.skipPointerMovePicking=true
  scene.clearColor = new Color4(0.52, 0.61, 0.67, 1)
  scene.fogMode = Scene.FOGMODE_EXP2
  scene.fogDensity = world.limit > 26 ? 0.005 : 0.007
  scene.fogColor = new Color3(0.66, 0.71, 0.73)
  const skyTexture = new DynamicTexture('daylight sky', { width: 16, height: 256 }, scene, false)
  const skyInk = skyTexture.getContext() as CanvasRenderingContext2D
  const gradient = skyInk.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, '#39688b'); gradient.addColorStop(.5, '#c6d0cd'); gradient.addColorStop(1, '#778987')
  skyInk.fillStyle = gradient; skyInk.fillRect(0, 0, 16, 256); skyTexture.update()
  const skySurface = new StandardMaterial('daylight sky', scene)
  skySurface.emissiveTexture = skyTexture; skySurface.disableLighting = true
  skySurface.backFaceCulling = false; skySurface.fogEnabled = false
  const skyDome = MeshBuilder.CreateSphere('sky dome', { diameter: world.limit > 26 ? 480 : 240, segments: 24 }, scene)
  skyDome.material = skySurface; skyDome.infiniteDistance = true; skyDome.isPickable = false

  const camera = new UniversalCamera('player-camera', new Vector3(-3, 1.7, -22), scene)
  camera.minZ = 0.12
  camera.maxZ = world.limit > 26 ? 260 : 160
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
  sun.orthoLeft = world.limit>26 ? -92 : -38
  sun.orthoRight = world.limit>26 ? 92 : 38
  sun.orthoTop = world.limit>26 ? 92 : 38
  sun.orthoBottom = world.limit>26 ? -92 : -38
  sun.shadowMinZ = 1
  sun.shadowMaxZ = 110
  const shadows = new ShadowGenerator(options.mobile ? 1024 : 2048, sun)
  shadows.usePercentageCloserFiltering = !options.mobile
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
  const hospitalWall=material('hospital-wall','#d4e1d8'),hospitalTiles=material('hospital-tile','#c4d0cb'),hospitalLinen=material('hospital-linen','#e2ebe7'),hospitalSteel=material('hospital-enamel','#789b99')
  hospitalWall.emissiveColor=new Color3(.17,.19,.18)
  hospitalTiles.diffuseTexture=surfaceTexture('interior-floor',scene);hospitalTiles.emissiveColor=new Color3(.13,.15,.14)
  hospitalLinen.emissiveColor=new Color3(.22,.24,.23)
  const hospitalLight=material('hospital-light','#e5f0e9');hospitalLight.emissiveColor=new Color3(.75,.85,.8)
  const cityWall=material('city-plaster','#b5b7aa'),cityBrick=material('city-brick','#a29682'),cityConcrete=material('city-concrete','#9ba59e')
  cityWall.diffuseTexture=surfaceTexture('plaster',scene);cityBrick.diffuseTexture=palette.brick.diffuseTexture;cityConcrete.diffuseTexture=palette.concrete.diffuseTexture
  for(const m of [cityWall,cityBrick,cityConcrete])m.emissiveColor=new Color3(.12,.14,.13)
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
    topFaces?: SurfaceRect[],
  ) {
    const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene)
    if (topFaces && !(topFaces.length===1 && topFaces[0]!.left===x-width/2 && topFaces[0]!.right===x+width/2 && topFaces[0]!.near===z-depth/2 && topFaces[0]!.far===z+depth/2)) {
      const data = VertexData.ExtractFromMesh(mesh)
      const positions = Array.from(data.positions!), normals = Array.from(data.normals!), indices: number[] = []
      const uvs = Array.from(data.uvs!)
      for (let i=0;i<data.indices!.length;i+=3) {
        const a=data.indices![i]!,b=data.indices![i+1]!,c=data.indices![i+2]!
        if (normals[a*3+1]!<.5) indices.push(a,b,c)
      }
      for (const face of topFaces) {
        const start=positions.length/3
        for (const [xx,zz] of [[face.left,face.near],[face.left,face.far],[face.right,face.far],[face.right,face.near]]) {
          positions.push(xx!-x,height/2,zz!-z);normals.push(0,1,0);uvs.push((xx!-face.left)/width,(zz!-face.near)/depth)
        }
        // Babylon's left-handed mesh convention uses clockwise outward faces.
        indices.push(start,start+2,start+1,start,start+3,start+2)
      }
      data.positions=positions;data.normals=normals;data.indices=indices;data.uvs=uvs;data.applyToMesh(mesh)
    }
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
  const span = world.limit * 2 + 2
  box('neighbourhood-ground', 0, -0.13, 0, span, 0.25, span, material('paving', '#91988e'))
  const asphalt = material('asphalt', '#414e50'), paint = material('road-paint', '#d7ceaa'), curb = material('curb', '#d1ccba')
  for (const center of world.roadCenters) {
    box('north-south-street', center, .003, 0, 9, .014, span, asphalt)
    // Split crossing roads at intersections: overlapping near-coplanar asphalt caused flicker.
    let edge=-span/2
    for(const cross of [...world.roadCenters,span/2+4.5]) {
      const end=cross-4.5
      if(end>edge)box('east-west-street',(edge+end)/2,.003,center,end-edge,.014,8,asphalt)
      edge=cross+4.5
    }
    for (let n=-world.limit+2;n<world.limit;n+=4) {
      if(world.roadCenters.some(c=>Math.abs(n-c)<5))continue
      box('lane-dash',center,.02,n,.1,.02,1.8,paint)
      box('lane-dash',n,.02,center,1.8,.02,.1,paint)
      for(const edge of [-4.6,4.6])box('curb-inlay',center+edge,.02,n,.24,.03,3.8,curb)
    }
  }
  for (const x of world.roadCenters) for(const z of world.roadCenters)
    for(let stripe=-3.6;stripe<=3.7;stripe+=1.2)for(const side of [-5.1,5.1])
      box('crosswalk',x+stripe,.025,z+side,.65,.015,1.5,paint)
  const renderedSolids = MAP_SOLIDS.filter(s=>!detailedFurniture(s) && !['landmark-factory-crane','landmark-factory-hoist'].includes(s.id) && !s.id.startsWith('street-bench-') && !/hospital-bed-\d/.test(s.id))
  const topSurfaces = solidTopSurfaces(renderedSolids)
  for (const solid of renderedSolids)
    box(
      solid.id,
      solid.x,
      solid.y,
      solid.z,
      solid.width,
      solid.height,
      solid.depth,
      solid.id.startsWith('city-') ? solid.material==='plaster'?cityWall:solid.material==='brick'?cityBrick:['roof','concrete'].includes(solid.material)?cityConcrete:palette[solid.material] : solid.id.startsWith('landmark-hospital') ? solid.id.includes('mattress') ? hospitalLinen : /hospital-(floor|roof$)/.test(solid.id) ? hospitalTiles : solid.material==='plaster' ? hospitalWall : /bedhead|locker|nurses/.test(solid.id) ? hospitalSteel : palette[solid.material] : palette[solid.material],
      topSurfaces.get(solid.id),
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
  if(world.limit>26) {
    const medical=material('hospital white','#dbe3dc'),teal=material('hospital teal','#367c78')
    box('hospital ground floor',-48,.05,-48,29.5,.02,25.5,hospitalTiles)
    sign('MERCER GENERAL HOSPITAL',-48,8.5,-62.05,0,24,1.1)
    sign('EMERGENCY / WALK IN',-48,2.7,-65.65,0,10,.55)
    sign('WARD FLOORS / ROOF ↑',-30.5,1.5,-65.5,0,5,.65)
    for(let floor=0;floor<3;floor++) {
      for(const x of [-57,-48,-39])for(const z of [-54,-42])box('hospital ceiling light',x,floor*3.2+2.875,z,1.4,.025,.45,hospitalLight)
      for(const side of [-1,1])for(const dz of [-7,7]){
        const x=-48+side*9,z=-48+dz,y=floor*3.2
        box('hospital bed frame',x,y+.7,z,1.12,.12,2.22,hospitalSteel)
        for(const dx of [-.43,.43])for(const zz of [-.85,.85])box('hospital bed leg',x+dx,y+.32,z+zz,.07,.64,.07,hospitalSteel)
        box('hospital pillow',x,y+.95,z+.65,.8,.1,.45,hospitalLinen)
        box('hospital blanket',x,y+.91,z-.25,1.08,.03,1.4,hospitalSteel)
      }
      sign(floor===0?'RECEPTION / EMERGENCY':floor===1?'WARD A / RECOVERY':'WARD B / OBSERVATION',-48,floor*3.2+2.5,-60.65,Math.PI,4,.45)
      for(const side of [-1,1])box('hospital corridor guide',-48+side*3.18,floor*3.2+1.1,-54.5,.02,.18,9,teal)
    }
    box('hospital roof landing marker',-48,9.62,-48,7,.025,.22,medical)
    box('hospital roof landing marker',-51,9.62,-48,.22,.025,7,medical)
    box('hospital roof landing marker',-45,9.62,-48,.22,.025,7,medical)
    box('factory work floor',0,.05,48,33.4,.02,25.4,palette.concrete)
    box('tower ground floor',48,.05,48,13.4,.02,15.4,palette.concrete)
    sign('NORTH IRONWORKS',0,7.65,33.95,0,17,1.3)
    sign('LOADING HALL / ENTER',0,3.85,33.95,0,5.5,.55)
    sign('MEZZANINE / ROOF ↑',13,1.4,43,0,3,.6)
    sign('ROOF ACCESS ↑',-14,5.3,56,Math.PI,3,.6)
    sign('FOUNDRY / OPERATIONS',48,11.3,38.95,0,12,1)
    sign('STAIRS / ALL FLOORS ↑',58,1.4,36.8,0,5,.65)
    for(let floor=0;floor<4;floor++)sign(`LEVEL 0${floor+1}`,48,floor*3.2+2.3,40.3,Math.PI,3,.55)
    for(const z of [39,47,55]) {
      box('factory overhead beam',0,7.3,z,33,.4,.35,palette.metal)
      for(const x of [-10,0,10])box('factory hanging light',x,6.9,z,2.8,.12,.6,paint)
    }
    box('factory gantry crane',0,5.8,46,22,.6,.8,material('crane enamel','#b29043'))
    box('factory hoist',1,5,46,1.5,1,.9,palette.metal)
    box('factory hoist cable',1,4.1,46,.05,.9,.05,palette.metal)
    for(const x of [-8,6,-7])box('factory warning band',x,1.55,x===-8?42.47:x===6?46.47:50.47,3.8,.18,.025,paint)
    for(let floor=1;floor<=4;floor++) {
      const z=floor%2===1?55.6:38.6,y=floor*3.2
      for(const x of [57.5,60.5])box('stair rail post',x,y+.5,z+(floor%2===1?.9:-.9),.09,1,.09,palette.metal)
    }
  }
  // Imported window bays now skin the city; keep only usable interior fittings here.
  for(const b of BUILDINGS.filter(b=>b.id.startsWith('city-'))) {
    const floors=Math.round((b.height ?? 3.2)/3.2)
    for(let f=0;f<floors;f++)box('city ceiling light',b.x+3.5,f*3.2+2.98,b.z,2.4,.06,.5,hospitalLight)
    box('city entry floor',b.x,.015,b.z,17.5,.02,15.5,hospitalTiles)
    sign(b.name,b.x,2.55,b.z-8.25,0,6,.45)
  }
  for (const building of BUILDINGS) {
    if(building.id.startsWith('city-'))continue
    if(building.height && building.height>4.5)continue
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
    addFacades(scene, assets, shadows, world)
    interiorDetails(scene, shadows, world)
    for (const solid of MAP_SOLIDS.filter(s => s.id.startsWith('planter') || s.id.startsWith('street-bench-'))) {
      const tree = solid.id.startsWith('planter')
      const instance = (tree ? assets.tree : assets.bench).instantiateModelsToScene(n => `${solid.id}:${n}`, false)
      const root = new TransformNode(`street-prop:${solid.id}`, scene)
      root.position.set(solid.x, tree ? solid.y + solid.height / 2 : 0, solid.z)
      if (tree) root.rotation.y = solid.x * .71
      for (const node of instance.rootNodes) node.parent = root
      for (const mesh of root.getChildMeshes()) {
        mesh.isPickable = false; mesh.receiveShadows = true; mesh.freezeWorldMatrix()
        shadows.addShadowCaster(mesh)
        if (mesh.material instanceof PBRMaterial) {
          mesh.material.environmentIntensity = .6
          mesh.material.freeze()
        }
      }
    }
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

    const carSurfaces = new Map<string, PBRMaterial>()
    for (const [index, car] of PARKED_CARS.entries()) {
      const root = new TransformNode(car.id, scene)
      const instance = assets.sedan.instantiateModelsToScene((n) => `${car.id}-${n}`, false, {
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
        const source = mesh.material
        if (source instanceof PBRMaterial) {
          const color = ['original', 'blue', 'sand', 'olive'][index % 4]!
          let surface = carSurfaces.get(color)
          if (!surface) {
            surface = source.clone(`coupe ${color}`)!
            if (color !== 'original') {
              const texture = new Texture(`/textures/car-${color}.jpg`, scene, false, false)
              texture.wrapU = source.albedoTexture?.wrapU ?? Texture.WRAP_ADDRESSMODE
              texture.wrapV = source.albedoTexture?.wrapV ?? Texture.WRAP_ADDRESSMODE
              surface.albedoTexture = texture
            }
            surface.roughness = .32; surface.metallic = .25
            surface.reflectionTexture = reflection.cubeTexture; surface.environmentIntensity = .7
            carSurfaces.set(color, surface)
          }
          mesh.material = surface
        }
        mesh.freezeWorldMatrix()
      }
    }
  }

  for (const solid of MAP_SOLIDS.filter((value) => value.id.startsWith('lamp') || value.id.startsWith('city-lamp'))) {
    box('lamp-arm', solid.x + 0.45, 4.55, solid.z, 1, 0.12, 0.12, palette.metal)
    box('lamp-head', solid.x + 0.9, 4.5, solid.z, 0.45, 0.15, 0.65, paint)
  }
  // Unreachable skyline gives the small block context without adding traversable world size.
  const skyline = material('skyline', '#687d7b')
  sign('ROOF ACCESS  /  ↑', -20, 1.2, 5, 0, 2.4, 0.55)
  sign(world.name, 0, 3, world.limit + .35, 0, 6, .9)
  if(world.limit > 26) for(const d of COMBAT_DISTRICTS) sign(d.name,d.x+7,2.9,d.z+6,0,4.5,.65)
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
  const groups = new Map<string, Mesh[]>()
  for (const mesh of staticMeshes) {
    const surface = mesh.material as StandardMaterial
    const key=`${surface.uniqueId}/${Math.floor(mesh.position.x/32)}/${Math.floor(mesh.position.z/32)}`
    const group = groups.get(key) ?? []
    group.push(mesh)
    groups.set(key, group)
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
  if(world.limit > 26) scene.onBeforeRenderObservable.add(() => {
    sun.position.set(camera.position.x+25,45,camera.position.z-25)
  })
  const avatarMaterial = material('players', '#d9f99b')
  return { engine, scene, camera, shadows, avatarMaterial, addVehicles, roofHeight: ROOF_HEIGHT }
}
