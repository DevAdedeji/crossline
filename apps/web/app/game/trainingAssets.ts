import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { Scene } from '@babylonjs/core/scene'
import type { AssetContainer } from '@babylonjs/core/assetContainer'
import '@babylonjs/loaders/glTF'

/** Local, licensed GLB data only. See public/models/ATTRIBUTION.md. */
export async function loadTrainingAssets(scene: Scene, options: {mobile?: boolean} = {}) {
  const names = [
    'rocketbox-soldier',
    'lamoot-ak47',
    'rohezal-coupe',
    'polyhaven-apartment',
    'polyhaven-factory',
    'polyhaven-street-tree',
    'polyhaven-street-bench',
  ]
  async function load(name: string) {
    if (scene.isDisposed) throw new Error('Arena closed during loading')
    const mobile = options.mobile && (name.startsWith('polyhaven-') || name === 'rocketbox-soldier')
    const container = await LoadAssetContainerAsync(`/models/${name}${mobile ? '-mobile' : ''}.glb`, scene)
    // A route can close while a GLB is decoding, after scene disposal has fired.
    if (scene.isDisposed) { container.dispose(); throw new Error('Arena closed during loading') }
    return container
  }
  const containers: AssetContainer[] = []
  if (options.mobile) {
    // Bound simultaneous image decoding/upload, as well as retained texture size.
    for (const name of names) containers.push(await load(name))
  } else containers.push(...await Promise.all(names.map(load)))
  const [soldier, rifle, sedan, apartment, factory, tree, bench] = containers
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
