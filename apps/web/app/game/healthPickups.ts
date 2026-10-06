import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { Scene } from '@babylonjs/core/scene'
import { SOLO, type HealthPickup } from '@crossline/shared'
/** Grounded original supply-case geometry; availability comes only from match state. */
export function healthPickups(scene: Scene) {
  const packs = new Map<string, { body: Mesh; label: DynamicTexture; last: string }>()
  const green = new StandardMaterial('medical case green', scene)
  green.diffuseColor = Color3.FromHexString('#23785d')
  const white = new StandardMaterial('medical case marking', scene)
  white.diffuseColor = Color3.FromHexString('#e4fff0')
  white.emissiveColor = Color3.FromHexString('#183d29')
  return {
    sync(values: HealthPickup[], elapsed: number) {
      for (const p of values) {
        let entry = packs.get(p.id)
        if (!entry) {
          const body = MeshBuilder.CreateBox(
            `health-pack-${p.id}`,
            { width: 0.7, height: 0.28, depth: 0.5 },
            scene,
          )
          body.position.set(p.x, p.y + 0.16, p.z)
          body.material = green
          body.receiveShadows = true
          body.isPickable = false
          for (const [width, depth] of [
            [0.32, 0.08],
            [0.08, 0.32],
          ]) {
            const stripe = MeshBuilder.CreateBox(
              'medical plus',
              { width, height: 0.01, depth },
              scene,
            )
            stripe.parent = body
            stripe.position.y = 0.146
            stripe.material = white
            stripe.isPickable = false
          }
          const label = new DynamicTexture(
            `supply-label-${p.id}`,
            { width: 256, height: 64 },
            scene,
            false,
          )
          const material = new StandardMaterial(`supply-label-${p.id}`, scene)
          material.diffuseTexture = label
          material.emissiveColor = Color3.White()
          material.disableLighting = true
          material.backFaceCulling = false
          const sign = MeshBuilder.CreatePlane(
            `supply-sign-${p.id}`,
            { width: 1.2, height: 0.3 },
            scene,
          )
          sign.position.set(p.x, p.y + 0.7, p.z)
          sign.material = material
          sign.billboardMode = Mesh.BILLBOARDMODE_ALL
          sign.isPickable = false
          entry = { body, label, last: '' }
          packs.set(p.id, entry)
        }
        const ready = p.availableAt <= elapsed
        entry.body.setEnabled(ready)
        const text = ready ? `+${SOLO.heal} HP` : `${Math.ceil((p.availableAt - elapsed) / 1000)}s`
        if (text !== entry.last) {
          entry.label.drawText(
            text,
            null,
            46,
            'bold 36px Arial',
            ready ? '#defff0' : '#b0b9b4',
            '#163329',
            true,
          )
          entry.last = text
        }
      }
    },
  }
}
