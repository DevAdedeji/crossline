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
import { RIFLE, type Combatant, type ShotEvent } from '@crossline/shared/combat'

export function combatPresentation(
  scene: Scene,
  camera: UniversalCamera,
  assets: TrainingAssets,
  shadows: ShadowGenerator,
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
  const flash = MeshBuilder.CreateSphere('muzzle', { diameter: 0.1, segments: 6 }, scene)
  flash.parent = weapon
  flash.position.set(0, 0.075, 0.39)
  flash.renderingGroupId = 2
  const glow = material('muzzle glow', '#fff2a1')
  glow.emissiveColor = Color3.FromHexString('#ffcd65')
  flash.material = glow
  flash.setEnabled(false)
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
      shootUntil: number
      stationary: boolean
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
  const blood = material('small blood impact', '#8e2428')
  blood.specularColor = Color3.Black()
  const impacts: {
    mesh: ReturnType<typeof MeshBuilder.CreateSphere>
    velocity: Vector3
    remaining: number
  }[] = []
  const tracers: { mesh: ReturnType<typeof MeshBuilder.CreateLines>; remaining: number }[] = []
  function sync(actors: Combatant[]) {
    for (const actor of actors.filter((a) => a.bot)) {
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
        bot = {
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
          wrist: root.getDescendants().find((n) => n.name.endsWith('Wrist.R')) as
            | TransformNode
            | undefined,
          finger: root.getDescendants().find((n) => n.name.endsWith('Middle1.R')) as
            | TransformNode
            | undefined,
          yaw: actor.yaw,
          shootUntil: 0,
          stationary: Number(actor.id.slice(-1)) % 2 === 0,
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
      if (Vector3.Distance(bot.root.position, bot.previous) > 3)
        bot.root.position.copyFrom(bot.previous)
      bot.yaw = actor.yaw
      bot.gun.setEnabled(false)
      const action = !bot.alive
        ? 'Death'
        : clock < bot.reactUntil
          ? 'HitRecieve'
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
  function shot(event: ShotEvent, own: boolean) {
    const shooter = bots.get(event.shooterId)
    if (shooter) shooter.shootUntil = clock + 0.65
    if (event.damage > 0 && event.hitId) {
      const victim = bots.get(event.hitId)
      if (victim && !event.eliminated) {
        victim.reactUntil = clock + 0.3
      }
    }
    // Blood requires confirmed damage; solid world contacts produce dust.
    if (
      event.damage > 0 ||
      (!event.hitId &&
        Vector3.Distance(
          new Vector3(event.start.x, event.start.y, event.start.z),
          new Vector3(event.end.x, event.end.y, event.end.z),
        ) < 79)
    ) {
      for (let i = 0; i < (event.damage > 0 ? 7 : 5); i++) {
        const particle = MeshBuilder.CreateSphere(
          event.damage > 0 && event.hitId ? 'blood impact' : 'world impact',
          { diameter: event.damage > 0.0 ? 0.035 : 0.022, segments: 6 },
          scene,
        )
        particle.position.set(event.end.x, event.end.y, event.end.z)
        particle.material = event.damage > 0 && event.hitId ? blood : dust
        particle.isPickable = false
        impacts.push({
          mesh: particle,
          velocity: new Vector3(
            (Math.random() - 0.5) * 0.7,
            Math.random() * 0.6,
            (Math.random() - 0.5) * 0.7,
          ),
          remaining: 0.22,
        })
      }
    }

    if (own) {
      kick = 1
      flashTime = 0.055
      flash.setEnabled(true)
    }
    const line = MeshBuilder.CreateLines(
      'tracer',
      {
        points: [
          new Vector3(event.start.x, event.start.y, event.start.z),
          new Vector3(event.end.x, event.end.y, event.end.z),
        ],
      },
      scene,
    )
    line.color = own ? new Color3(1, 0.94, 0.55) : new Color3(1, 0.38, 0.15)
    tracers.push({ mesh: line, remaining: 0.075 })
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
    for (const bot of bots.values())
      for (const group of bot.animations)
        if (group.isStarted) {
          if (running && group.isPlaying === false) group.play(group.loopAnimation)
          else if (!running && group.isPlaying) group.pause()
        }
    if (running) clock += dt
    const effectDt = running ? dt : 0
    for (let i = impacts.length - 1; i >= 0; i--) {
      const effect = impacts[i]!
      effect.remaining -= effectDt
      effect.mesh.position.addInPlace(effect.velocity.scale(effectDt))
      effect.mesh.visibility = Math.max(0, effect.remaining / 0.22)
      if (effect.remaining <= 0) {
        effect.mesh.dispose()
        impacts.splice(i, 1)
      }
    }
    kick = Math.max(0, kick - effectDt * 9)
    flashTime -= effectDt
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
      -0.22 + ads * 0.097 + bob - tilt * 0.08,
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
    for (const impact of impacts) impact.mesh.dispose()
    for (const tracer of tracers) tracer.mesh.dispose()
    impacts.length = 0
    tracers.length = 0
  }
  return { sync, shot, frame, reset }
}

export { trainingAudio } from './trainingAudio'
