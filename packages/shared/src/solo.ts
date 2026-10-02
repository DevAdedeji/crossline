import { COMBAT_DISTRICTS } from './combat-map.ts'
export const SOLO = {
  maxHealth: 100, heal: 35, pickupRadius: 1.15, pickupFloorTolerance: .3, pickupCooldownMs: 25000,
  protectionMs: 4000, botBodyDamage: 10, botHeadDamage: 15,
  reactionMs: 1400, reactionJitterMs: 500, shotIntervalMs: 600, maxAttackers: 2,
  burstShots: 2, burstRestMs: 1800, burstRestJitterMs: 600, damageGraceMs: 450,
} as const
export interface HealthPickup { id: string; x: number; y: number; z: number; availableAt: number }
// Ground-level supply cases beside cover, one in every district plus two central routes.
export const SOLO_HEALTH_PACKS = [
  { id: 'supply-door', x: -6.5, y: 0, z: -13 },
  { id: 'south-cover', x: -5.3, y: 0, z: -17 },
  ...COMBAT_DISTRICTS.map((d,i)=>({id:`district-${i}`,x:d.x+2,y:0,z:d.z+20.5})),
]
