import type { Position } from './index.js'
import type { WorldGeometry } from './urban-map.js'
import { worldHit } from './combat.js'
export const GRENADE_FUSE_MS = 2600
export const GRENADE_FLIGHT_MS = 1100
export const GRENADE_RADIUS = 7
export interface CampaignGrenade {
  sourceId: string
  start: Position
  target: Position
  remainingMs: number
}
export function grenadePosition(grenade: CampaignGrenade): Position {
  const t=Math.max(0,Math.min(1,(GRENADE_FUSE_MS-grenade.remainingMs)/GRENADE_FLIGHT_MS))
  return {x:grenade.start.x+(grenade.target.x-grenade.start.x)*t,y:grenade.start.y+(grenade.target.y+.12-grenade.start.y)*t+4*3*t*(1-t),z:grenade.start.z+(grenade.target.z-grenade.start.z)*t}
}
/** Refuse throws whose arc crosses a wall or ceiling. */
export function clearGrenadeArc(grenade: CampaignGrenade, world: WorldGeometry): boolean {
  let previous=grenadePosition(grenade)
  for(let i=1;i<=20;i++) {
    const next=grenadePosition({...grenade,remainingMs:GRENADE_FUSE_MS-GRENADE_FLIGHT_MS*i/20})
    const dx=next.x-previous.x,dy=next.y-previous.y,dz=next.z-previous.z,length=Math.hypot(dx,dy,dz)
    if(worldHit(previous,{x:dx/length,y:dy/length,z:dz/length},length,world)<length-.02)return false
    previous=next
  }
  return true
}
export function grenadeDamage(target: Position, blast: Position, world: WorldGeometry): number {
  const distance=Math.hypot(target.x-blast.x,target.y-blast.y,target.z-blast.z)
  if(distance>=GRENADE_RADIUS)return 0
  const origin={...blast,y:blast.y+.35},dx=target.x-origin.x,dy=target.y+1-origin.y,dz=target.z-origin.z,length=Math.hypot(dx,dy,dz)
  if(length>.01&&worldHit(origin,{x:dx/length,y:dy/length,z:dz/length},length,world)<length-.02)return 0
  return Math.round(45*(1-distance/GRENADE_RADIUS))
}
