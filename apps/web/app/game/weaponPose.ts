import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

/** Shoulder the rifle and solve both arms after locomotion/crouch animation. */
export function weaponPose(
  scene: Scene,
  root: TransformNode,
  gun: TransformNode,
  state: () => { alive: boolean; pitch: number; recoil: number; reload: boolean },
) {
  const nodes = root.getDescendants() as TransformNode[]
  const find = (name: string) => nodes.find((n) => n.name.endsWith(name))
  const chest = find('Bip01 Spine2')
  const arms = ['R', 'L'].map((side) => ({
    side,
    upper: find(`Bip01 ${side} UpperArm`),
    lower: find(`Bip01 ${side} Forearm`),
    hand: find(`Bip01 ${side} Hand`),
    finger: find(`Bip01 ${side} Finger2`),
  }))
  let saved: { node: TransformNode; rotation: Quaternion }[] = []
  function restore() {
    for (const p of saved) p.node.rotationQuaternion = p.rotation
    saved = []
  }
  function aim(node: TransformNode, child: TransformNode, target: Vector3) {
    node.computeWorldMatrix(true)
    child.computeWorldMatrix(true)
    const inverse = Matrix.Invert((node.parent as TransformNode).computeWorldMatrix(true))
    const origin = node.getAbsolutePosition()
    const from = Vector3.TransformNormal(
      child.getAbsolutePosition().subtract(origin),
      inverse,
    ).normalize()
    const to = Vector3.TransformNormal(target.subtract(origin), inverse).normalize()
    const axis = Vector3.Cross(from, to),
      dot = Math.max(-1, Math.min(1, Vector3.Dot(from, to)))
    if (axis.lengthSquared() < 0.000001) return
    node.rotationQuaternion = Quaternion.RotationAxis(axis.normalize(), Math.acos(dot)).multiply(
      node.rotationQuaternion ?? Quaternion.FromEulerVector(node.rotation),
    )
    node.computeWorldMatrix(true)
  }
  const before = scene.onBeforeAnimationsObservable.add(restore)
  const after = scene.onAfterAnimationsObservable.add(() => {
    const pose = state()
    if (!pose.alive || !chest || !root.isEnabled()) return
    for (const arm of arms)
      for (const node of [arm.upper, arm.lower, arm.hand])
        if (node)
          saved.push({
            node,
            rotation: (
              node.rotationQuaternion ?? Quaternion.FromEulerVector(node.rotation)
            ).clone(),
          })
    chest.computeWorldMatrix(true)
    const chestLocal = Vector3.TransformCoordinates(
      chest.getAbsolutePosition(),
      Matrix.Invert(root.computeWorldMatrix(true)),
    )
    const pitch = Math.max(-1.1, Math.min(1.1, pose.pitch)) + (pose.reload ? 0.35 : 0)
    gun.rotationQuaternion = Quaternion.FromEulerAngles(
      pitch - pose.recoil * 0.025,
      0,
      pose.reload ? -0.15 : 0,
    )
    // Pivot at the shoulder stock, rather than swinging the stock through the face.
    const stockOffset = new Vector3(0, 0.015, -0.625)
    stockOffset.rotateByQuaternionToRef(gun.rotationQuaternion, stockOffset)
    gun.position.set(
      0.12 - stockOffset.x,
      chestLocal.y + 0.04 - stockOffset.y,
      chestLocal.z - 0.075 - stockOffset.z - pose.recoil * 0.025,
    )
    const gunMatrix = gun.computeWorldMatrix(true)
    for (const arm of arms) {
      if (!arm.upper || !arm.lower || !arm.hand || !arm.finger) continue
      arm.upper.computeWorldMatrix(true)
      arm.lower.computeWorldMatrix(true)
      arm.hand.computeWorldMatrix(true)
      const shoulder = arm.upper.getAbsolutePosition().clone()
      const upperLength = Vector3.Distance(shoulder, arm.lower.getAbsolutePosition())
      const lowerLength = Vector3.Distance(
        arm.lower.getAbsolutePosition(),
        arm.hand.getAbsolutePosition(),
      )
      const grip = Vector3.TransformCoordinates(
        new Vector3(
          arm.side === 'R' ? 0.015 : -0.025,
          arm.side === 'R' ? -0.075 : -0.035,
          arm.side === 'R' ? -0.34 : -0.12,
        ),
        gunMatrix,
      )
      const direction = grip.subtract(shoulder),
        distance = Math.max(0.001, Math.min(direction.length(), upperLength + lowerLength - 0.001))
      const axis = direction.normalize()
      const along = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance)
      const pole = Vector3.TransformNormal(
        new Vector3(arm.side === 'R' ? 1 : -1, -1, -0.25),
        root.getWorldMatrix(),
      )
      const bend = pole.subtract(axis.scale(Vector3.Dot(pole, axis))).normalize()
      const elbow = shoulder
        .add(axis.scale(along))
        .add(bend.scale(Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2))))
      aim(arm.upper, arm.lower, elbow)
      aim(arm.lower, arm.hand, shoulder.add(axis.scale(distance)))
      const forward = Vector3.TransformNormal(new Vector3(0, -0.35, 1), gunMatrix).normalize()
      aim(arm.hand, arm.finger, arm.hand.getAbsolutePosition().add(forward.scale(0.1)))
    }
  })
  return () => {
    restore()
    scene.onBeforeAnimationsObservable.remove(before)
    scene.onAfterAnimationsObservable.remove(after)
  }
}
