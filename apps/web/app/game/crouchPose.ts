import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'
/** Additive two-bone leg pose over the licensed idle/walk animation; restored before each animation tick. */
export function crouchPose(scene:Scene,root:TransformNode,amount:()=>number) {
  const nodes=root.getDescendants() as TransformNode[]
  const find=(name:string)=>nodes.find(n=>n.name.endsWith(name))
  const pelvis=find('Bip01 Pelvis'),spine=find('Bip01 Spine')
  const legs=['L','R'].map(side=>({thigh:find(`Bip01 ${side} Thigh`),calf:find(`Bip01 ${side} Calf`),foot:find(`Bip01 ${side} Foot`)}))
  let saved:{node:TransformNode;position:Vector3;rotation:Quaternion}[]=[]
  const restore=()=>{for(const p of saved){p.node.position.copyFrom(p.position);p.node.rotationQuaternion=p.rotation.clone()}saved=[]}
  function aim(node:TransformNode,child:TransformNode,target:Vector3) {
    node.computeWorldMatrix(true);child.computeWorldMatrix(true)
    const parentInverse=Matrix.Invert((node.parent as TransformNode).computeWorldMatrix(true))
    const origin=node.getAbsolutePosition()
    const from=Vector3.TransformNormal(child.getAbsolutePosition().subtract(origin),parentInverse).normalize()
    const to=Vector3.TransformNormal(target.subtract(origin),parentInverse).normalize()
    const axis=Vector3.Cross(from,to),dot=Math.max(-1,Math.min(1,Vector3.Dot(from,to)))
    if(axis.lengthSquared()<.000001)return
    node.rotationQuaternion=Quaternion.RotationAxis(axis.normalize(),Math.acos(dot)).multiply(node.rotationQuaternion ?? Quaternion.FromEulerVector(node.rotation))
    node.computeWorldMatrix(true)
  }
  const before=scene.onBeforeAnimationsObservable.add(restore)
  const after=scene.onAfterAnimationsObservable.add(()=>{
    const c=amount();if(c<=.001||!pelvis||!spine)return
    for(const node of [pelvis,spine,...legs.flatMap(l=>[l.thigh,l.calf])])if(node)saved.push({node,position:node.position.clone(),rotation:(node.rotationQuaternion ?? Quaternion.FromEulerVector(node.rotation)).clone()})
    for(const node of nodes)node.computeWorldMatrix(true)
    const feet=legs.map(l=>{
      if(!l.thigh||!l.calf||!l.foot)return null
      const hip=l.thigh.getAbsolutePosition().clone(),knee=l.calf.getAbsolutePosition().clone(),ankle=l.foot.getAbsolutePosition().clone()
      return {ankle,upper:Vector3.Distance(hip,knee),lower:Vector3.Distance(knee,ankle)}
    })
    const forward=new Vector3(Math.sin(root.rotation.y),0,Math.cos(root.rotation.y))
    pelvis.setAbsolutePosition(pelvis.getAbsolutePosition().add(forward.scale(-.15*c)).add(new Vector3(0,-.57*c,0)))
    pelvis.computeWorldMatrix(true)
    for(const [i,l] of legs.entries()) {
      const f=feet[i];if(!f||!l.thigh||!l.calf||!l.foot)continue
      l.thigh.computeWorldMatrix(true)
      const hip=l.thigh.getAbsolutePosition().clone(),line=f.ankle.subtract(hip),d=Math.min(line.length(),f.upper+f.lower-.0001),axis=line.normalize()
      const along=(f.upper*f.upper-f.lower*f.lower+d*d)/(2*Math.max(d,.001))
      const bend=forward.subtract(axis.scale(Vector3.Dot(forward,axis))).normalize()
      const knee=hip.add(axis.scale(along)).add(bend.scale(Math.sqrt(Math.max(0,f.upper*f.upper-along*along))))
      aim(l.thigh,l.calf,knee);l.calf.computeWorldMatrix(true);aim(l.calf,l.foot,f.ankle)
    }
    // Small forward torso lean while keeping the upper body and weapon articulated.
    spine.rotationQuaternion=(spine.rotationQuaternion ?? Quaternion.Identity()).multiply(Quaternion.RotationAxis(new Vector3(0,0,1),-.16*c))
  })
  return ()=>{restore();scene.onBeforeAnimationsObservable.remove(before);scene.onAfterAnimationsObservable.remove(after)}
}
