import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { Scene } from '@babylonjs/core/scene'
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import type { Solid, WorldGeometry } from '@crossline/shared'

/** Replace furniture proxies inside their existing authoritative footprints. */
export function detailedFurniture(s: Solid) {
  return (
    /^(cafe-counter|garage-bench|store-shelf)$/.test(s.id) ||
    /^(landmark-tower-(desk|cabinet)|city-\d+-\d+-(desk|locker)|landmark-hospital-(locker|nurses))-/.test(
      s.id,
    )
  )
}
export function interiorDetails(scene: Scene, shadows: ShadowGenerator, world: WorldGeometry) {
  const groups = new Map<string, { material: PBRMaterial; meshes: Mesh[] }>()
  function surface(name: string, color: string, metallic = 0, roughness = 0.7) {
    const m = new PBRMaterial(name, scene)
    m.albedoColor = Color3.FromHexString(color)
    m.metallic = metallic
    m.roughness = roughness
    return m
  }
  const wood = surface('furniture oak', '#b39c7c'),
    steel = surface('furniture steel', '#4c575b', 0.65, 0.4),
    black = surface('equipment charcoal', '#242d30', 0.15),
    white = surface('ceramic and paper', '#e8e3d6', 0, 0.38),
    enamel = surface('cabinet enamel', '#a8b9b3', 0.12, 0.5),
    red = surface('workshop red', '#813d34', 0.1),
    teal = surface('archive teal', '#375e63'),
    card = surface('shipping cartons', '#9a7951'),
    brass = surface('handles brass', '#ac8f53', 0.65, 0.4),
    screen = surface('inactive display glass', '#172d35', 0.2, 0.22)
  const grain = new DynamicTexture('original oak grain', { width: 256, height: 64 }, scene, false),
    ctx = grain.getContext() as CanvasRenderingContext2D
  ctx.fillStyle = '#b9a17e'
  ctx.fillRect(0, 0, 256, 64)
  for (let i = 0; i < 34; i++) {
    ctx.strokeStyle = i % 3 ? '#9e836044' : '#66503b55'
    ctx.lineWidth = i % 4 === 0 ? 1.5 : 0.6
    ctx.beginPath()
    ctx.moveTo(0, i * 2)
    ctx.bezierCurveTo(70, i * 2 + Math.sin(i) * 3, 180, i * 2 - 2, 256, i * 2 + 1)
    ctx.stroke()
  }
  grain.update()
  wood.albedoTexture = grain
  wood.albedoColor = Color3.White()
  function add(mesh: Mesh, material: PBRMaterial) {
    mesh.material = material
    const p = mesh.position,
      key = `${material.uniqueId}/${Math.floor(p.x / 32)}/${Math.floor(p.z / 32)}`
    let group = groups.get(key)
    if (!group) {
      group = { material, meshes: [] }
      groups.set(key, group)
    }
    group.meshes.push(mesh)
    return mesh
  }
  function box(
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: PBRMaterial,
  ) {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene)
    mesh.position.set(x, y, z)
    return add(mesh, m)
  }
  function cylinder(
    name: string,
    x: number,
    y: number,
    z: number,
    diameter: number,
    height: number,
    m: PBRMaterial,
  ) {
    const mesh = MeshBuilder.CreateCylinder(name, { diameter, height, tessellation: 12 }, scene)
    mesh.position.set(x, y, z)
    return add(mesh, m)
  }
  const signs = new Map<string, PBRMaterial>()
  function sign(text: string, x: number, y: number, z: number, w: number, h: number) {
    let m = signs.get(text)
    if (!m) {
      m = surface(text, '#ffffff')
      const t = new DynamicTexture(text, { width: 512, height: 128 }, scene, false),
        c = t.getContext()
      c.fillStyle = '#253c3e'
      c.fillRect(0, 0, 512, 128)
      c.fillStyle = '#d4bd86'
      c.fillRect(16, 16, 5, 96)
      c.font = 'bold 25px Arial'
      c.fillStyle = '#ece9df'
      c.fillText(text, 38, 73)
      t.update()
      m.albedoTexture = t
      signs.set(text, m)
    }
    box('framed room sign', x, y, z, w + 0.06, h + 0.06, 0.04, wood)
    const panel = MeshBuilder.CreatePlane(
      'room sign',
      { width: w, height: h, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    )
    panel.position.set(x, y, z + 0.025)
    panel.rotation.y = Math.PI
    add(panel, m)
  }
  function drawers(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    count: number,
    m: PBRMaterial,
  ) {
    for (let i = 0; i < count; i++) {
      const cy = y - h / 2 + ((i + 0.5) * h) / count
      box('recessed drawer face', x, cy, z, w - 0.08, h / count - 0.035, 0.025, m)
      box('drawer pull', x, cy + 0.025, z - 0.03, Math.min(0.3, w * 0.4), 0.025, 0.035, steel)
    }
  }
  function desk(s: Solid) {
    const bottom = s.y - s.height / 2,
      top = bottom + 0.76,
      z = s.z - s.depth / 2
    box('oak desk carcass', s.x, bottom + 0.35, s.z, s.width, 0.7, s.depth, wood)
    box('desk writing top', s.x, top, s.z, s.width, 0.07, s.depth, wood)
    drawers(s.x - s.width * 0.31, bottom + 0.38, z - 0.012, s.width * 0.32, 0.59, 3, enamel)
    box(
      'desk inset front',
      s.x + s.width * 0.17,
      bottom + 0.35,
      z - 0.01,
      s.width * 0.59,
      0.62,
      0.025,
      black,
    )
    box('monitor pedestal', s.x + 0.23, top + 0.07, s.z + 0.15, 0.29, 0.07, 0.22, steel)
    box('monitor body', s.x + 0.23, top + 0.21, s.z + 0.19, 0.54, 0.27, 0.075, black)
    box('monitor screen', s.x + 0.23, top + 0.21, s.z + 0.149, 0.46, 0.21, 0.006, screen)
    box('keyboard', s.x + 0.2, top + 0.055, s.z - 0.24, 0.5, 0.025, 0.18, black)
    for (let row = 0; row < 3; row++)
      for (let key = 0; key < 9; key++)
        box(
          'keyboard key',
          s.x - 0.01 + key * 0.05,
          top + 0.071,
          s.z - 0.3 + row * 0.05,
          0.035,
          0.009,
          0.031,
          enamel,
        )
    for (let n = 0; n < 3; n++) {
      box(
        'stacked report cover',
        s.x - 0.55,
        top + 0.065 + n * 0.037,
        s.z - 0.18,
        0.35,
        0.015,
        0.42,
        n % 2 ? teal : red,
      )
      box('report pages', s.x - 0.55, top + 0.05 + n * 0.037, s.z - 0.18, 0.33, 0.02, 0.4, white)
    }
  }
  function locker(s: Solid) {
    box('storage cabinet case', s.x, s.y, s.z, s.width, s.height, s.depth, steel)
    const z = s.z - s.depth / 2 - 0.015
    for (const side of [-1, 1]) {
      const x = s.x + side * s.width * 0.245
      box('cabinet door', x, s.y, z, s.width * 0.47, s.height - 0.08, 0.025, enamel)
      box(
        'vertical cabinet pull',
        x - side * s.width * 0.14,
        s.y,
        z - 0.03,
        0.027,
        0.2,
        0.035,
        brass,
      )
      for (let line = 0; line < 4; line++)
        box(
          'cabinet vent',
          x,
          s.y + s.height * 0.32 + line * 0.04,
          z - 0.016,
          s.width * 0.3,
          0.012,
          0.006,
          black,
        )
      box('cabinet inventory card', x, s.y + 0.15, z - 0.018, s.width * 0.22, 0.09, 0.008, white)
    }
  }
  for (const s of world.solids) {
    if (/(tower|city-\d+-\d+)-desk-/.test(s.id) || s.id.startsWith('landmark-hospital-nurses-'))
      desk(s)
    else if (/(tower-cabinet|city-\d+-\d+-locker|hospital-locker)-/.test(s.id)) locker(s)
  }
  // Original three furnished businesses. Other single-storey district rooms stay empty.
  box('cafe counter oak base', -15, 0.53, 9, 3, 1.06, 0.9, wood)
  box('cafe polished worktop', -15, 1.1, 9, 3, 0.065, 0.9, black)
  drawers(-15, 0.66, 8.535, 2.85, 0.6, 2, wood)
  for (const x of [-15.95, -15, -14.05]) {
    box('customer counter panel', x, 0.58, 9.465, 0.88, 0.83, 0.025, wood)
    box('counter brass trim', x, 0.99, 9.486, 0.88, 0.025, 0.016, brass)
  }
  box('espresso chassis', -15.8, 1.32, 9, 0.66, 0.4, 0.48, steel)
  box('espresso front fascia', -15.8, 1.33, 9.25, 0.58, 0.27, 0.022, enamel)
  for (const x of [-15.98, -15.67]) {
    const knob = cylinder('espresso pressure gauge', x, 1.4, 9.276, 0.065, 0.022, white)
    knob.rotation.x = Math.PI / 2
    box('espresso outlet', x, 1.2, 9.31, 0.045, 0.08, 0.08, black)
  }
  box('drip tray', -15.8, 1.145, 9.31, 0.62, 0.025, 0.14, black)
  for (const x of [-15.95, -15.66, -14.7]) {
    cylinder('coffee cup', x, 1.21, 9.3, 0.105, 0.12, white)
    const handle = MeshBuilder.CreateTorus(
      'cup handle',
      { diameter: 0.075, thickness: 0.018, tessellation: 12 },
      scene,
    )
    handle.position.set(x + 0.067, 1.21, 9.3)
    handle.rotation.z = Math.PI / 2
    add(handle, white)
  }
  box('coffee grinder base', -14.85, 1.27, 9.1, 0.25, 0.27, 0.29, black)
  cylinder('grinder bean hopper', -14.85, 1.48, 9.1, 0.22, 0.16, card)
  sign('MERCER CAFE / COFFEE + BAKERY', -14, 2.5, 6.23, 4.5, 0.8)
  box('garage workbench base', 16, 0.53, 15, 3.2, 1.06, 1, red)
  box('garage stainless worktop', 16, 1.1, 15, 3.2, 0.05, 1, steel)
  for (const x of [15, 16, 17]) drawers(x, 0.56, 14.48, 0.93, 0.89, 4, red)
  box('bench vise base', 15, 1.15, 15, 0.32, 0.06, 0.3, steel)
  box('bench vise jaws', 15, 1.25, 15, 0.28, 0.16, 0.24, steel)
  box('vise jaw gap', 15, 1.31, 14.99, 0.3, 0.022, 0.045, black)
  box('workshop pegboard', 16, 2.1, 16.76, 3.6, 1.35, 0.05, card)
  for (let col = 0; col < 8; col++)
    for (let row = 0; row < 4; row++)
      box('pegboard hole', 14.5 + col * 0.43, 1.63 + row * 0.28, 16.725, 0.024, 0.024, 0.005, black)
  for (let i = 0; i < 5; i++) {
    box('hanging spanner', 14.7 + i * 0.6, 2.15, 16.69, 0.065, 0.55, 0.03, steel)
    const jaw = cylinder('spanner head', 14.7 + i * 0.6, 2.45, 16.69, 0.14, 0.035, steel)
    jaw.rotation.x = Math.PI / 2
  }
  sign('NORTHSIDE / SERVICE + REPAIRS', 13, 2.65, 7.24, 3.3, 0.55)
  // Backed stock rack retains its original full cover footprint; layered goods break up its silhouette.
  box('supply rack back', -17, 1, -15.9, 3.5, 2, 0.075, steel)
  for (const x of [-18.7, -17, -15.3]) box('rack upright', x, 1, -15.5, 0.065, 2, 0.9, steel)
  for (const y of [0.09, 0.7, 1.31, 1.94]) box('stock shelf', -17, y, -15.5, 3.5, 0.055, 0.9, steel)
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 5; col++) {
      const x = -18.32 + col * 0.64,
        y = 0.37 + row * 0.61
      box('stock package', x, y, -15.53, 0.49, 0.49, 0.56, col % 3 ? card : teal)
      box('carton tape', x, y + 0.25, -15.53, 0.055, 0.005, 0.56, white)
      box('stock product label', x, y, -15.244, 0.23, 0.14, 0.009, white)
    }
  sign('BLOCK SUPPLY / STOCK + DISPATCH', -17, 2.65, -17.76, 4, 0.65)
  // Hospital: small chart boards on existing ward walls, cabinet details and linen folds.
  if (world.buildings.some((b) => b.id === 'mercer-hospital'))
    for (let floor = 0; floor < 3; floor++)
      for (const side of [-1, 1]) {
        const y = floor * 3.2,
          x = -48 + side * 9
        sign(
          floor === 0 ? 'WARD / TRIAGE' : floor === 1 ? 'WARD / RECOVERY' : 'WARD / OBSERVATION',
          x,
          y + 2.1,
          -60.75,
          2.6,
          0.4,
        )
        for (const dz of [-7, 7])
          for (let fold = 0; fold < 4; fold++)
            box(
              'linen fold',
              x,
              y + 0.936,
              -48 + dz - 0.75 + fold * 0.3,
              1.02,
              0.007,
              0.014,
              enamel,
            )
      }
  // Machine operator panels stay on existing factory covers, clear of the loading lanes.
  for (const s of world.solids.filter((s) => /^landmark-factory-machine-\d+$/.test(s.id))) {
    const z = s.z - s.depth / 2 - 0.015
    box('machine access panel', s.x, s.y, z, s.width * 0.77, s.height * 0.76, 0.025, enamel)
    box('machine display bezel', s.x - 0.7, s.y + 0.45, z - 0.025, 0.65, 0.4, 0.03, black)
    box('machine display', s.x - 0.7, s.y + 0.45, z - 0.044, 0.53, 0.29, 0.008, screen)
    for (let n = 0; n < 3; n++) {
      const button = cylinder(
        'machine control button',
        s.x + 0.3 + n * 0.28,
        s.y + 0.42,
        z - 0.04,
        0.09,
        0.028,
        n === 0 ? red : brass,
      )
      button.rotation.x = Math.PI / 2
    }
    for (let n = 0; n < 6; n++)
      box(
        'machine cooling slot',
        s.x + 0.4,
        s.y - 0.15 - n * 0.08,
        z - 0.023,
        1.2,
        0.035,
        0.008,
        black,
      )
  }
  for (const { material, meshes } of groups.values()) {
    const mesh = Mesh.MergeMeshes(meshes, true, true)!
    mesh.receiveShadows = true
    mesh.freezeWorldMatrix()
    shadows.addShadowCaster(mesh)
    material.freeze()
  }
}
