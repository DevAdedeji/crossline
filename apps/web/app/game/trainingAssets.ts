import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { Scene } from '@babylonjs/core/scene'
import '@babylonjs/loaders/glTF'

/** Local, licensed GLB data only. See public/models/ATTRIBUTION.md. */
export async function loadTrainingAssets(scene: Scene) {
  const [soldier, rifle, sedan, apartment, factory, tree, bench] = await Promise.all(
    [
      'rocketbox-soldier',
      'lamoot-ak47',
      'rohezal-coupe',
      'polyhaven-apartment',
      'polyhaven-factory',
      'polyhaven-street-tree',
      'polyhaven-street-bench',
    ].map((name) => LoadAssetContainerAsync(`/models/${name}.glb`, scene)),
  )
  for (const material of soldier!.materials) {
    if (material instanceof PBRMaterial) {
      material.metallic = 0; material.roughness = 0.82
      if (['sm002_body', 'sm002_helmet', 'sm002_equipment'].includes(material.name)) {
        // Keep fabric/gear detail and skin tones while making the uniform charcoal black.
        material.albedoColor = Color3.FromHexString(material.name === 'sm002_equipment' ? '#343b43' : '#252b33')
      }
    }
  }
  for (const material of rifle!.materials) {
    if (material instanceof PBRMaterial && material.name === 'blued steel') {
      material.albedoColor = new Color3(0.12, 0.14, 0.16)
      material.roughness = 0.38
    }
  }
  function gun(name: string, parent: TransformNode, length = 0.78) {
    const root = new TransformNode(name, scene)
    root.parent = parent
    const instance = rifle!.instantiateModelsToScene((n) => `${name}-${n}`, false, {
      doNotInstantiate: true,
    })
    const pivot = new TransformNode(`${name}-orientation`, scene)
    pivot.parent = root
    pivot.rotation.y = Math.PI / 2
    const model = instance.rootNodes[0]! as TransformNode
    model.parent = pivot
    model.scaling.scaleInPlace(length / 5.493686)
    // Center the long axis, put the sights just above the attachment origin.
    model.position.x = (1.08008 * length) / 5.493686
    return root
  }
  return { soldier: soldier!, sedan: sedan!, apartment: apartment!, factory: factory!, tree: tree!, bench: bench!, gun }
}
export type TrainingAssets = Awaited<ReturnType<typeof loadTrainingAssets>>
