import { worldHit, type Combatant } from './combat.ts'
import { stanceAim } from './stance.ts'
import type { Position } from './index.ts'
import type { WorldGeometry } from './urban-map.ts'
/** Labels never disclose players behind authoritative cover or beyond close street range. */
export function nameVisible(view:Position,target:Combatant,world:WorldGeometry):boolean {
 if(target.health<=0 || target.participating===false)return false
 const dx=target.x-view.x,dy=target.y+stanceAim(target)-view.y,dz=target.z-view.z,d=Math.hypot(dx,dy,dz)
 return d>1 && d<=32 && worldHit(view,{x:dx/d,y:dy/d,z:dz/d},d,world)>=d-.02
}
