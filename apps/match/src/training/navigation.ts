import { move, isBlocked, TICK_MS, type Position, type WorldGeometry, TRAINING_WORLD } from '@crossline/shared'

// Doorways, street junctions, alleys and the rooftop approach. Edges are checked with real collision.
export const NAV_POINTS: Position[] = [
  [0, -21],
  [-6, -22],
  [-21, -22],
  [-21, -20],
  [-24, -20],
  [-24, 5.2],
  [-20, 5.2],
  [-20, 15.2, 4.1],
  [-17, 15.2, 4.1],
  [-12, 11, 4.1],
  [-12, 7, 4.1],
  [-1, -16],
  [-1, -6],
  [3, -6],
  [-3, 0],
  [3, 0],
  [-12, -4.5],
  [-21, -4.5],
  [-22, 5],
  [-12, 4.5],
  [-12, 11],
  [-3, 11],
  [-12, 18],
  [3, 6],
  [5.5, 12],
  [13, 12],
  [13, 5.5],
  [21, 6],
  [21, 12],
  [21, 18],
  [3, 21],
  [-3, 21],
  [-12, 21],
  [-23, 21],
  [12, -6],
  [13, -18],
  [22, -14],
  [13, -22],
  [-14, -13],
  [-5.5, -13],
]
  .map(([x, z, y = 0]) => ({ x: x!, y, z: z! }))
  .filter((point) => !isBlocked(point))
const cache = new WeakMap<WorldGeometry, ReturnType<typeof createNavigation>>()
function createNavigation(world: WorldGeometry) {
  const candidates = [...NAV_POINTS,...(world.navigationPoints ?? [])]
  if (world !== TRAINING_WORLD) {
    for (let x=-72;x<=72;x+=6) for(let z=-72;z<=72;z+=6) candidates.push({x,y:0,z})
    for(const b of world.buildings) candidates.push({x:b.x,y:0,z:b.z},{x:b.x+b.width/2+1,y:0,z:b.z},{x:b.x,y:0,z:b.z+b.depth/2+1})
  }
  const points = [...new Map(candidates.map(p=>[`${p.x}/${p.y}/${p.z}`,p])).values()].filter(p=>!isBlocked(p,world))
function canWalk(from: Position, to: Position): boolean {
  let position = { ...from }
  const distance = Math.hypot(to.x - from.x, to.z - from.z)
  if (distance > 18 || Math.abs(to.y - from.y) > 4.2) return false
  // Avoid diagonal rooftop drops that depend on exact edge timing; prefer aligned ramps/stair flights.
  if(from.y>to.y+.5 && Math.abs(from.x-to.x)>.5)return false
  for (let tick = 0; tick < Math.ceil(distance / 0.19) + 5; tick++) {
    const dx = to.x - position.x
    const dz = to.z - position.z
    const length = Math.hypot(dx, dz)
    if (length < 0.25) return Math.abs(position.y - to.y) < 0.3
    const next = move(position, { x: dx / length, z: dz / length }, TICK_MS, world)
    if (Math.hypot(next.x - position.x, next.z - position.z) < 0.01) return false
    position = next
  }
  return false
}
const edges = new Map<number, number[]>()
const cells = new Map<string,number[]>()
for(const [i,p] of points.entries()) {const key=`${Math.floor(p.x/18)}/${Math.floor(p.z/18)}`;const list=cells.get(key) ?? [];list.push(i);cells.set(key,list)}
function localPoints(p:Position) {
 const indices:number[]=[],x=Math.floor(p.x/18),z=Math.floor(p.z/18)
 for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)indices.push(...(cells.get(`${x+dx}/${z+dz}`) ?? []))
 return indices
}
function neighbors(index: number): number[] {
  let result = edges.get(index)
  if (!result) {
    result = localPoints(points[index]!).filter(other=>other!==index && canWalk(points[index]!,points[other]!))
    edges.set(index, result)
  }
  return result
}
function nearest(position: Position): number {
  const sorted = localPoints(position).map(index => ({
    index,
    distance:
      Math.hypot(points[index]!.x - position.x, points[index]!.z - position.z) + Math.abs(points[index]!.y - position.y) * 5,
  })).sort((a, b) => a.distance - b.distance)
  return (
    sorted.find((entry) => canWalk(position, points[entry.index]!))?.index ?? sorted[0]!.index
  )
}
function findPath(from: Position, destination: Position): Position[] {
  if (canWalk(from, destination)) return [{ ...destination }]
  const start = nearest(from)
  const goal = nearest(destination)
  const frontier:{index:number;cost:number;priority:number}[]=[]
  function push(index:number,cost:number) {
    const node={index,cost,priority:cost+Math.hypot(points[index]!.x-destination.x,points[index]!.z-destination.z)}
    frontier.push(node);let i=frontier.length-1
    while(i>0){const parent=(i-1)>>1;if(frontier[parent]!.priority<=node.priority)break;frontier[i]=frontier[parent]!;i=parent}frontier[i]=node
  }
  function pop(){
    const first=frontier[0]!,last=frontier.pop()!
    if(frontier.length){let i=0;while(i*2+1<frontier.length){let child=i*2+1;if(child+1<frontier.length && frontier[child+1]!.priority<frontier[child]!.priority)child++;if(last.priority<=frontier[child]!.priority)break;frontier[i]=frontier[child]!;i=child}frontier[i]=last}
    return first
  }
  push(start,0)
  const previous = new Map<number, number>()
  const cost = new Map([[start, 0]])
  while (frontier.length) {
    const entry=pop(),current=entry.index
    if(entry.cost!==(cost.get(current) ?? Infinity))continue
    if (current === goal) {
      const path = [goal]
      while (path[0] !== start) path.unshift(previous.get(path[0]!)!)
      return path.map((index) => ({ ...points[index]! }))
    }
    for (const neighbor of neighbors(current)) {
      const a = points[current]!
      const b = points[neighbor]!
      const nextCost = cost.get(current)! + Math.hypot(a.x - b.x, a.z - b.z) + Math.abs(a.y - b.y)
      if (nextCost < (cost.get(neighbor) ?? Infinity)) {
        cost.set(neighbor, nextCost)
        previous.set(neighbor, current)
        push(neighbor,nextCost)
      }
    }
  }
  return [{ ...points[start]! }]
}

  async function precompute() {
    let batchStart=performance.now()
    for(let i=0;i<points.length;i++) {
      neighbors(i)
      if(performance.now()-batchStart>4) { await new Promise<void>(resolve=>setImmediate(resolve)); batchStart=performance.now() }
    }
  }
  return { points, canWalk, findPath, precompute }
}
export function getNavigation(world: WorldGeometry = TRAINING_WORLD) {
  let navigation = cache.get(world)
  if (!navigation) { navigation=createNavigation(world); cache.set(world,navigation) }
  return navigation
}
export const canWalk = (from: Position, to: Position) => getNavigation().canWalk(from,to)
export const findPath = (from: Position, to: Position) => getNavigation().findPath(from,to)
