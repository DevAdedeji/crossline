import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import type { Scene } from '@babylonjs/core/scene'

/** Let WebKit consume a bounded batch of graphics commands before enqueueing more. */
export async function flushStaticUploads(scene: Scene) {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  if (scene.isDisposed) throw new Error('Arena closed during construction')
}

/** Batch immutable shapes before uploading. Thousands of temporary WebGL buffers
 * can exhaust WebKit's graphics process even when the final mesh is small. */
export class StaticGeometry {
  private readonly pending = new WeakMap<Mesh, VertexData>()
  constructor(private readonly scene: Scene) {}

  create(name: string, data: VertexData) {
    const mesh = new Mesh(name, this.scene)
    this.pending.set(mesh, data)
    return mesh
  }

  merge(meshes: Mesh[]) {
    if (!meshes.length) return null
    const data = meshes.map(mesh => {
      const vertices = this.pending.get(mesh) ?? VertexData.ExtractFromMesh(mesh, true, true)
      return vertices.transform(mesh.computeWorldMatrix(true))
    })
    const combined = data[0]!
    if (data.length > 1) combined.merge(data.slice(1), true)
    const merged = new Mesh(meshes[0]!.name, this.scene)
    combined.applyToMesh(merged)
    merged.material = meshes[0]!.material
    for (const mesh of meshes) { this.pending.delete(mesh); mesh.dispose() }
    return merged
  }
}
