import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import type { Scene } from '@babylonjs/core/scene'
/** Deterministic original surface artwork: no external texture requests. */
export function surfaceTexture(kind: string, scene: Scene) {
  const size = 512,
    texture = new DynamicTexture(`surface-${kind}`, { width: size, height: size }, scene, true),
    ctx = texture.getContext()
  let seed = 314159
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const pixels = ctx.getImageData(0, 0, size, size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let shade = 232 + (random() - 0.5) * 12
      if (kind === 'brick') {
        const row = Math.floor(y / 32),
          mortar = y % 32 < 2 || (x + (row % 2) * 64) % 128 < 2
        shade = mortar ? 135 : 190 + random() * 42
      }
      if (kind === 'wood')
        shade = 170 + 35 * Math.sin(x * 0.35 + Math.sin(y * 0.02)) + random() * 22
      if (kind === 'interior-floor' || kind === 'paving') {
        const slab = kind === 'paving' ? 128 : 256
        const xx = x % slab,
          yy = y % slab
        const joint = xx < 2 || yy < 2
        const edge = xx < 5 || yy < 5 || xx > slab - 4 || yy > slab - 4
        const variation = Math.sin(Math.floor(x / slab) * 13 + Math.floor(y / slab) * 29) * 6
        shade = joint ? 142 : (edge ? 208 : 232) + variation + (random() - 0.5) * 10
      }
      if (kind === 'aggregate')
        shade = 178 + (random() - 0.5) * 65 + 7 * Math.sin(x * 0.061) * Math.cos(y * 0.049)
      if (kind === 'roof') shade = y % 64 < 2 ? 140 : 210 + random() * 25
      const i = (y * size + x) * 4
      pixels.data[i] = shade
      pixels.data[i + 1] = shade
      pixels.data[i + 2] = shade
      pixels.data[i + 3] = 255
    }
  ctx.putImageData(pixels, 0, 0)
  texture.update()
  // World-space UVs extend beyond 0–1. Clamping stretches the edge pixel over
  // entire floors and walls, making them look like flat white sheets.
  texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE
  texture.anisotropicFilteringLevel = 4
  return texture
}
