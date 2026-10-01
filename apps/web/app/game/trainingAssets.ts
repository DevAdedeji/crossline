import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { Scene } from '@babylonjs/core/scene'
import '@babylonjs/loaders/glTF'

/** Local, licensed GLB data only. See public/models/ATTRIBUTION.md. */
export async function loadTrainingAssets(scene: Scene) {
  const [soldier, rifle, sedan, apartment, factory] = await Promise.all(
    [
      'quaternius-swat',
      'quaternius-rifle',
      'quaternius-sedan',
      'polyhaven-apartment',
      'polyhaven-factory',
    ].map((name) => LoadAssetContainerAsync(`/models/${name}.glb`, scene)),
  )
  for (const material of soldier!.materials) {
    if (material instanceof PBRMaterial) {
      material.metallic = 0
      material.roughness = material.name === 'Skin' ? 0.82 : 0.94
      if (material.name === 'Swat') material.albedoColor = Color3.FromHexString('#465244')
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
  return { soldier: soldier!, sedan: sedan!, apartment: apartment!, factory: factory!, gun }
}
export type TrainingAssets = Awaited<ReturnType<typeof loadTrainingAssets>>
