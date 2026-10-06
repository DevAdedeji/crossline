import type { Solid } from '@crossline/shared'

export interface SurfaceRect {
  left: number
  right: number
  near: number
  far: number
}

/** Give overlapping stair/landing tops a single visible owner, without changing collision. */
export function solidTopSurfaces(solids: readonly Solid[]): Map<string, SurfaceRect[]> {
  const planes = new Map<number, SurfaceRect[]>()
  const result = new Map<string, SurfaceRect[]>()
  for (const solid of solids) {
    const level = Math.round((solid.y + solid.height / 2) * 10000)
    const prior = planes.get(level) ?? []
    const top = {
      left: solid.x - solid.width / 2,
      right: solid.x + solid.width / 2,
      near: solid.z - solid.depth / 2,
      far: solid.z + solid.depth / 2,
    }
    let pieces = [top]
    for (const other of prior) {
      if (
        other.right <= top.left ||
        other.left >= top.right ||
        other.far <= top.near ||
        other.near >= top.far
      )
        continue
      pieces = pieces.flatMap((piece) => {
        const left = Math.max(piece.left, other.left),
          right = Math.min(piece.right, other.right)
        const near = Math.max(piece.near, other.near),
          far = Math.min(piece.far, other.far)
        if (right <= left || far <= near) return [piece]
        return [
          { ...piece, right: left },
          { ...piece, left: right },
          { left, right, near: piece.near, far: near },
          { left, right, near: far, far: piece.far },
        ].filter((p) => p.right - p.left > 1e-6 && p.far - p.near > 1e-6)
      })
      if (!pieces.length) break
    }
    prior.push(top)
    planes.set(level, prior)
    result.set(solid.id, pieces)
  }
  return result
}
