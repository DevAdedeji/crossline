import { crouchPose } from './crouchPose'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { Ray } from '@babylonjs/core/Culling/ray'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector'
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import type { Scene } from '@babylonjs/core/scene'
import type { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera'
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup'
import type { TrainingAssets } from './trainingAssets'
import { RIFLE, type Combatant, type ShotEvent, type GameMode } from '@crossline/shared/combat'

export function combatPresentation(
  scene: Scene,
  camera: UniversalCamera,
  assets: TrainingAssets,
  shadows: ShadowGenerator,
  mode: GameMode = 'training',
) {
  const material = (name: string, color: string) => {
    const m = new StandardMaterial(name, scene)
    m.diffuseColor = Color3.FromHexString(color)
    return m
  }
  const weapon = new TransformNode('CL-24', scene)
  weapon.parent = camera
  const gun = assets.gun('first-person-carbine', weapon)
  const magazine = gun.getDescendants().find((node) => node.name.endsWith('Magazine')) as
    | TransformNode
    | undefined
  const magazineHome = magazine?.position.clone()
  for (const mesh of weapon.getChildMeshes()) {
    mesh.renderingGroupId = 2
    mesh.isPickable = false
  }
  // Find the barrel tip from the imported model rather than guessing an offset.
  const localVertices:Vector3[]=[]
  const inverseWeapon=Matrix.Invert(weapon.computeWorldMatrix(true))
  for(const mesh of gun.getChildMeshes()){
    const positions=mesh.getVerticesData('position');if(!positions)continue
    const matrix=mesh.computeWorldMatrix(true).multiply(inverseWeapon)
    for(let i=0;i<positions.length;i+=3)localVertices.push(Vector3.TransformCoordinates(new Vector3(positions[i],positions[i+1],positions[i+2]),matrix))
  }
  const tipZ=Math.max(...localVertices.map(p=>p.z))
  const rim=localVertices.filter(p=>p.z>tipZ-.006)
  const muzzlePoint=new Vector3((Math.min(...rim.map(p=>p.x))+Math.max(...rim.map(p=>p.x)))/2,(Math.min(...rim.map(p=>p.y))+Math.max(...rim.map(p=>p.y)))/2,tipZ+.003)
  // Two narrow crossed flame sheets point down the barrel; no camera-facing yellow orb.
  const flash = new TransformNode('directional muzzle flash',scene)
  flash.parent=weapon;flash.position.copyFrom(muzzlePoint)
  const flameTexture=new DynamicTexture('muzzle flame texture',{width:64,height:128},scene,false)
  flameTexture.hasAlpha=true
  const flameInk=flameTexture.getContext() as CanvasRenderingContext2D
  flameInk.clearRect(0,0,64,128)
  const flameGradient=flameInk.createLinearGradient(0,128,0,0)
  flameGradient.addColorStop(0,'rgba(255,250,217,.9)');flameGradient.addColorStop(.3,'rgba(255,194,89,.8)');flameGradient.addColorStop(1,'rgba(245,105,35,0)')
  flameInk.fillStyle=flameGradient;flameInk.beginPath()
  flameInk.moveTo(24,128);flameInk.lineTo(10,79);flameInk.lineTo(24,93);flameInk.lineTo(29,4);flameInk.lineTo(39,68);flameInk.lineTo(53,37);flameInk.lineTo(43,106);flameInk.lineTo(39,128);flameInk.closePath();flameInk.fill();flameTexture.update()
  const glow=material('muzzle flame','#ffffff')
  glow.diffuseTexture=flameTexture;glow.useAlphaFromDiffuseTexture=true;glow.disableLighting=true;glow.emissiveColor=Color3.White();glow.backFaceCulling=false
  for(const angle of [0,Math.PI/2]){
    const turn=new TransformNode('flame orientation',scene);turn.parent=flash;turn.rotation.z=angle
    const flame=MeshBuilder.CreatePlane('barrel flame',{width:.03,height:.10},scene)
    flame.parent=turn;flame.rotation.x=Math.PI/2;flame.position.z=.045;flame.material=glow;flame.renderingGroupId=2;flame.isPickable=false
  }
  flash.setEnabled(false)
  const smokeTexture=new DynamicTexture('muzzle smoke texture',64,scene,false);smokeTexture.hasAlpha=true
  const smokeInk=smokeTexture.getContext() as CanvasRenderingContext2D
  smokeInk.clearRect(0,0,64,64)
  const haze=smokeInk.createRadialGradient(30,35,2,32,32,30);haze.addColorStop(0,'rgba(192,198,200,.35)');haze.addColorStop(1,'rgba(192,198,200,0)');smokeInk.fillStyle=haze;smokeInk.fillRect(0,0,64,64);smokeTexture.update()
  const smokeMaterial=material('muzzle smoke','#c0c6c8');smokeMaterial.diffuseTexture=smokeTexture;smokeMaterial.useAlphaFromDiffuseTexture=true;smokeMaterial.disableLighting=true;smokeMaterial.emissiveColor=Color3.White();smokeMaterial.backFaceCulling=false;smokeMaterial.disableDepthWrite=true
  const smoke=Array.from({length:3},()=>{const mesh=MeshBuilder.CreatePlane('brief muzzle smoke',{size:.09},scene);mesh.material=smokeMaterial;mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;mesh.isPickable=false;mesh.setEnabled(false);return {mesh,remaining:0}})
  let smokeIndex=0
  scene.setRenderingAutoClearDepthStencil(2, true, true, true)
  const bots = new Map<
    string,
    {
      root: TransformNode
      animations: AnimationGroup[]
      action: string
      previous: Vector3
      moving: boolean
      motionUntil: number
      alive: boolean
      gun: TransformNode
      reactUntil: number
      wrist: TransformNode | undefined
      finger: TransformNode | undefined
      yaw: number
      crouch: number
      shootUntil: number
      stationary: boolean
      dispose: () => void
      spawnStamp: number
      rest: {
        node: TransformNode
        position: Vector3
        rotation: Vector3
        quaternion: Quaternion | null
        scale: Vector3
      }[]
    }
  >()
  let kick = 0,
    flashTime = 0,
    clock = 0,
    ads = 0
  const dust = material('fabric impact', '#aaa79b')
  dust.specularColor = Color3.Black()
  const blood = material('small blood impact', '#a92329')
  blood.specularColor = Color3.Black()
  blood.emissiveColor = Color3.FromHexString('#481014')
  const splashTexture = new DynamicTexture('blood splash texture', 128, scene, false)
  splashTexture.hasAlpha = true
  const ink = splashTexture.getContext() as CanvasRenderingContext2D
  ink.clearRect(0, 0, 128, 128)
  ink.fillStyle = '#b52b32'
  for (let i = 0; i < 11; i++) {
    const angle = i * 2.39996
    const radius = 12 + (i % 4) * 8
    ink.beginPath()
    ink.ellipse(
      64 + Math.cos(angle) * radius,
      64 + Math.sin(angle) * radius,
      5 + (i % 3) * 2,
      3 + (i % 2),
      angle,
      0,
      Math.PI * 2,
    )
    ink.fill()
  }
  splashTexture.update()
  const splashMaterial = material('blood splash', '#ffffff')
  splashMaterial.diffuseTexture = splashTexture
  splashMaterial.useAlphaFromDiffuseTexture = true
  splashMaterial.disableLighting = true
  splashMaterial.emissiveColor = Color3.White()
  splashMaterial.backFaceCulling = false
  const impacts: {
    mesh: ReturnType<typeof MeshBuilder.CreateSphere>
    velocity: Vector3
    remaining: number
    duration: number
  }[] = []
  const tracers: { mesh: ReturnType<typeof MeshBuilder.CreateLines>; remaining: number }[] = []
  function sync(actors: Combatant[]) {
    const visibleActors = actors.filter(a=>(a.bot || mode === 'online') && a.participating !== false)
    const ids = new Set(visibleActors.map(a=>a.id))
    for(const [id, actor] of bots) if(!ids.has(id)) { actor.dispose(); bots.delete(id) }
    for (const actor of visibleActors) {
      let bot = bots.get(actor.id)
      if (!bot) {
        const root = new TransformNode(actor.id, scene)
        const instance = assets.soldier.instantiateModelsToScene((n) => `${actor.id}-${n}`, false, {
          doNotInstantiate: true,
        })
        for (const node of instance.rootNodes) {
          node.parent = root
          ;(node as TransformNode).scaling.scaleInPlace(0.962)
        }
        for (const skeleton of instance.skeletons) skeleton.useTextureToStoreBoneMatrices = true
        for (const group of instance.animationGroups) {
          group.stop()
          for (const target of group.targetedAnimations) {
            target.animation.enableBlending = true
            target.animation.blendingSpeed = 0.15
          }
        }
        for (const mesh of root.getChildMeshes()) {
          mesh.receiveShadows = true
          mesh.isPickable = false
          mesh.alwaysSelectAsActiveMesh = true
          shadows.addShadowCaster(mesh)
        }
        const gun = assets.gun(`${actor.id}-carbine`, root, 0.7)
        gun.position.set(0.18, 1.13, 0.3)
        const poseState={amount:0}
        const disposePose=crouchPose(scene,root,()=>poseState.amount)
        bot = {
          get crouch(){return poseState.amount},
          set crouch(value:number){poseState.amount=value},
          dispose: () => {
            disposePose()
            for(const mesh of root.getChildMeshes())shadows.removeShadowCaster(mesh)
            for(const group of instance.animationGroups)group.dispose()
            for(const skeleton of instance.skeletons)skeleton.dispose()
            root.dispose(false,false)
          },
          spawnStamp: actor.protectedUntil,
          rest: root
            .getDescendants()
            .filter((node): node is TransformNode => node instanceof TransformNode)
            .map((node) => ({
              node,
              position: node.position.clone(),
              rotation: node.rotation.clone(),
              quaternion: node.rotationQuaternion?.clone() ?? null,
              scale: node.scaling.clone(),
            })),
          root,
          animations: instance.animationGroups,
          action: '',
          previous: new Vector3(actor.x, actor.y, actor.z),
          moving: false,
          motionUntil: 0,
          alive: true,
          gun,
          reactUntil: 0,
          wrist: root.getDescendants().find((n) => n.name.endsWith('Bip01 R Hand')) as
            | TransformNode
            | undefined,
          finger: root.getDescendants().find((n) => n.name.endsWith('Bip01 R Finger2')) as
            | TransformNode
            | undefined,
          yaw: actor.yaw,
          shootUntil: 0,
          stationary: mode === 'training' && Number(actor.id.slice(-1)) % 2 === 0,
        }
        bots.set(actor.id, bot)
      }
      if (actor.health > 0 && (actor.protectedUntil !== bot.spawnStamp || !bot.alive)) {
        for (const group of bot.animations) group.stop()
        for (const pose of bot.rest) {
          pose.node.position.copyFrom(pose.position)
          pose.node.rotation.copyFrom(pose.rotation)
          pose.node.rotationQuaternion = pose.quaternion?.clone() ?? null
          pose.node.scaling.copyFrom(pose.scale)
        }
        bot.action = ''
        bot.motionUntil = 0
        bot.reactUntil = 0
        bot.shootUntil = 0
        bot.spawnStamp = actor.protectedUntil
        bot.root.setEnabled(true)
        bot.root.position.set(actor.x, actor.y, actor.z)
        bot.root.rotation.y = actor.yaw
        bot.previous.copyFrom(bot.root.position)
      }
      if (Math.hypot(actor.x - bot.previous.x, actor.z - bot.previous.z) > 0.006)
        bot.motionUntil = clock + 0.12
      bot.moving = clock < bot.motionUntil
      bot.previous.set(actor.x, actor.y, actor.z)
      bot.alive = actor.health > 0
      bot.crouch = bot.alive ? actor.crouch ?? 0 : 0
      if (Vector3.Distance(bot.root.position, bot.previous) > 3)
        bot.root.position.copyFrom(bot.previous)
      bot.yaw = actor.yaw
      bot.gun.setEnabled(mode !== 'training' && bot.alive)
      const action = !bot.alive
        ? 'Death'
        : clock < bot.reactUntil
          ? 'HitRecieve'
          : mode !== 'training' && actor.reloadUntil > 0
            ? 'Interact'
          : bot.stationary
            ? 'Idle_Neutral'
            : clock < bot.shootUntil
              ? 'Idle_Gun_Pointing'
              : bot.moving
                ? 'Walk'
                : 'Idle_Neutral'

      if (action !== bot.action) {
        for (const group of bot.animations) group.stop()
        const animation = bot.animations.find((group) => group.name.endsWith(`|${action}`))
        animation?.start(
          action !== 'Death' && action !== 'HitRecieve',
          action === 'HitRecieve' ? 2.5 : action === 'Walk' ? 0.7 : 1,
        )
        bot.action = action
      }
    }
  }
  function fire(){
    kick=1;flashTime=.025;flash.rotation.z=Math.random()*Math.PI;flash.setEnabled(true)
    const puff=smoke[smokeIndex++%smoke.length]!;puff.remaining=.24
    puff.mesh.position.copyFrom(Vector3.TransformCoordinates(muzzlePoint,weapon.computeWorldMatrix(true)))
    puff.mesh.scaling.setAll(1);puff.mesh.visibility=.28;puff.mesh.setEnabled(true)
  }
  function shot(event: ShotEvent, own: boolean, feedback=true) {
    const shooter = bots.get(event.shooterId)
    if (shooter) shooter.shootUntil = clock + 0.65
    if (event.damage > 0 && event.hitId) {
      const victim = bots.get(event.hitId)
      if (victim && !event.eliminated) {
        victim.reactUntil = clock + 0.3
      }
    }
    // Resolve presentation against the visible victim surface, not an interior hitbox point.
    const damagingHit = event.damage > 0 && !!event.hitId
    const start = new Vector3(event.start.x, event.start.y, event.start.z)
    let contact = new Vector3(event.end.x, event.end.y, event.end.z)
    const direction = contact.subtract(start).normalize()
    // Maintain a readable angular size at range; cap growth so close hits stay restrained.
    const distance = Vector3.Distance(camera.position, contact)
    const bloodScale = Math.max(1, Math.min(3.6, distance / 12))
    if (damagingHit) {
      const victim = bots.get(event.hitId!)
      const meshes = new Set(victim?.root.getChildMeshes().filter((mesh) => mesh.isEnabled()))
      const surface = scene.pickWithRay(
        new Ray(start, direction, Vector3.Distance(start, contact) + 2),
        (mesh) => meshes.has(mesh),
      )
      contact = (surface?.pickedPoint ?? contact.subtract(direction.scale(0.25)))
        .subtract(direction.scale(0.08))
      const splash = MeshBuilder.CreatePlane('blood splash', { size: 0.62 }, scene)
      splash.position.copyFrom(contact)
      splash.scaling.setAll(bloodScale)
      splash.billboardMode = Mesh.BILLBOARDMODE_ALL
      splash.material = splashMaterial
      splash.isPickable = false
      impacts.push({ mesh: splash, velocity: direction.scale(-0.15), remaining: 0.65, duration: 0.65 })
    }
    // Misses at maximum range and protected/dead actors produce no blood.
    if (damagingHit || (!event.hitId && Vector3.Distance(start, contact) < 79)) {
      const duration = damagingHit ? 0.65 : 0.22
      for (let i = 0; i < (damagingHit ? 9 : 5); i++) {
        const particle = MeshBuilder.CreateSphere(
          damagingHit ? 'blood impact' : 'world impact',
          { diameter: damagingHit ? 0.08 * Math.sqrt(bloodScale) : 0.022, segments: 4 },
          scene,
        )
        particle.position.copyFrom(contact)
        particle.material = damagingHit ? blood : dust
        particle.isPickable = false
        const spread = damagingHit ? 1.5 : 0.7
        const velocity = new Vector3(
          (Math.random() - 0.5) * spread,
          Math.random() * 0.6,
          (Math.random() - 0.5) * spread,
        )
        if (damagingHit) velocity.subtractInPlace(direction.scale(0.6))
        impacts.push({ mesh: particle, velocity, remaining: duration, duration })
      }
    }

    if (own && feedback) fire()
    const line = MeshBuilder.CreateLines(
      'tracer',
      {
        points: [
          own ? Vector3.TransformCoordinates(muzzlePoint,weapon.computeWorldMatrix(true)) : new Vector3(event.start.x, event.start.y, event.start.z),
          new Vector3(event.end.x, event.end.y, event.end.z),
        ],
      },
      scene,
    )
    line.color = own ? new Color3(.85, 0.78, 0.6) : new Color3(1, 0.38, 0.15)
    tracers.push({ mesh: line, remaining: 0.045 })
  }
  function frame(
    dt: number,
    aiming: boolean,
    moving: boolean,
    reloadRemaining: number,
    alive: boolean,
    running = true,
  ) {
    for (const bot of bots.values()) {
      if (running) {
        Vector3.LerpToRef(bot.root.position, bot.previous, Math.min(1, dt * 20), bot.root.position)
        const delta = Math.atan2(
          Math.sin(bot.yaw - bot.root.rotation.y),
          Math.cos(bot.yaw - bot.root.rotation.y),
        )
        bot.root.rotation.y += delta * Math.min(1, dt * 8)
      }
      if (bot.wrist && bot.finger && !bot.stationary) {
        const inverse = Matrix.Invert(bot.root.computeWorldMatrix(true))
        const wrist = Vector3.TransformCoordinates(bot.wrist.getAbsolutePosition(), inverse),
          finger = Vector3.TransformCoordinates(bot.finger.getAbsolutePosition(), inverse),
          forward = finger.subtract(wrist).normalize()
        const up = Math.abs(forward.y) > 0.9 ? new Vector3(0, 0, -1) : Vector3.Up()
        bot.gun.position.copyFrom(wrist.add(forward.scale(0.14)).add(up.scale(0.035)))
        bot.gun.rotationQuaternion = Quaternion.FromLookDirectionRH(forward, up)
      }
    }
    for (const bot of bots.values()) {
      bot.root.setEnabled(Vector3.DistanceSquared(bot.root.position, camera.position) < 95 * 95)
      for (const group of bot.animations)
        if (group.isStarted) {
          if (running && bot.root.isEnabled() && group.isPlaying === false) group.play(group.loopAnimation)
          else if ((!running || !bot.root.isEnabled()) && group.isPlaying) group.pause()
        }
    }
    if (running) clock += dt
    const effectDt = running ? dt : 0
    for (let i = impacts.length - 1; i >= 0; i--) {
      const effect = impacts[i]!
      effect.remaining -= effectDt
      effect.mesh.position.addInPlace(effect.velocity.scale(effectDt))
      effect.mesh.visibility = Math.max(0, effect.remaining / effect.duration)
      if (effect.remaining <= 0) {
        effect.mesh.dispose()
        impacts.splice(i, 1)
      }
    }
    kick = Math.max(0, kick - effectDt * 9)
    for(const puff of smoke){
      if(puff.remaining<=0)continue
      puff.remaining-=dt;puff.mesh.position.y+=dt*.12;puff.mesh.scaling.setAll(1+(.24-puff.remaining)*2)
      puff.mesh.visibility=Math.max(0,puff.remaining/.24)*.28
      if(puff.remaining<=0)puff.mesh.setEnabled(false)
    }
    flashTime -= dt
    if (flashTime <= 0) flash.setEnabled(false)
    weapon.setEnabled(alive)
    const reloading = reloadRemaining > 0
    const reloadProgress = reloading
      ? Math.max(0, Math.min(1, 1 - reloadRemaining / RIFLE.reloadMs))
      : null
    const tilt =
      reloadProgress === null ? 0 : Math.min(1, reloadProgress / 0.16, (1 - reloadProgress) / 0.16)
    if (magazine && magazineHome) {
      const p = reloadProgress ?? 0
      const drop =
        p < 0.2
          ? 0
          : p < 0.4
            ? (p - 0.2) / 0.2
            : p < 0.55
              ? 1
              : p < 0.72
                ? 1 - (p - 0.55) / 0.17
                : 0
      const offset = Vector3.TransformNormal(
        Vector3.TransformNormal(new Vector3(0, -drop * 0.3, 0), weapon.computeWorldMatrix(true)),
        Matrix.Invert((magazine.parent as TransformNode).computeWorldMatrix(true)),
      )
      magazine.position.copyFrom(magazineHome.add(offset))
      magazine.setEnabled(!(p >= 0.4 && p < 0.55))
    }
    ads += ((aiming && !reloading ? 1 : 0) - ads) * Math.min(1, dt * 16)
    const bob = moving && !aiming ? Math.sin(clock * 10) * 0.008 : 0
    weapon.position.set(
      (1 - ads) * 0.24,
      -0.14 + ads * 0.105 + bob - tilt * 0.08,
      0.35 - kick * 0.035,
    )
    weapon.rotation.set(-kick * 0.05 + tilt * 0.15, -tilt * 0.12, -tilt * 0.45)
    camera.fov += (1.2 - ads * 0.43 - camera.fov) * Math.min(1, dt * 15)
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i]!
      t.remaining -= effectDt
      if (t.remaining <= 0) {
        t.mesh.dispose()
        tracers.splice(i, 1)
      }
    }
  }
  function reset() {
    kick = 0
    flashTime = 0
    ads = 0
    flash.setEnabled(false)
    for(const puff of smoke){puff.remaining=0;puff.mesh.setEnabled(false)}
    for (const impact of impacts) impact.mesh.dispose()
    for (const tracer of tracers) tracer.mesh.dispose()
    impacts.length = 0
    tracers.length = 0
  }
  return { sync, shot, fire, frame, reset }
}

export { trainingAudio } from './trainingAudio'
