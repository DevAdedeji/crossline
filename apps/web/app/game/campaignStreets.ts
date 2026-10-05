import type { WorldGeometry } from '@crossline/shared'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
type Box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,surface:PBRMaterial)=>Mesh
type Material=(name:string,color:string)=>PBRMaterial

export function campaignStreets(world:WorldGeometry,box:Box,material:Material){
  const patches=world.surfaces
  if(!patches)return
  const surfaces={asphalt:material('asphalt','#414e50'),grass:material('park grass','#536144'),paving:material('interior-floor','#b9b09a'),apron:material('airport apron','#98978a'),rail:material('rail ballast','#625e52')}
  const paint=material('street marking','#d0c8b2'),yellow=material('taxiway marking','#c79f43'),steel=material('rail steel','#484e4b')
  // Partition overlapping rectangles into a single surface, avoiding road/plaza flicker.
  const xs=[...new Set(patches.flatMap(p=>[p.x-p.width/2,p.x+p.width/2]))].sort((a,b)=>a-b)
  const zs=[...new Set(patches.flatMap(p=>[p.z-p.depth/2,p.z+p.depth/2]))].sort((a,b)=>a-b)
  for(let zi=0;zi<zs.length-1;zi++)for(let xi=0;xi<xs.length-1;xi++){
    const x=(xs[xi]!+xs[xi+1]!)/2,z=(zs[zi]!+zs[zi+1]!)/2
    const patch=[...patches].reverse().find(p=>Math.abs(x-p.x)<p.width/2&&Math.abs(z-p.z)<p.depth/2)
    if(patch)box('site surface',x,.003,z,xs[xi+1]!-xs[xi]!, .014,zs[zi+1]!-zs[zi]!,surfaces[patch.kind])
  }
  for(const p of patches){
    if(p.kind==='rail'){
      for(let x=p.x-p.width/2+8;x<p.x+p.width/2;x+=15){
        for(const side of [-1,1])box('rail',x+side*.8,.05,p.z,.1,.08,p.depth,steel)
        for(let z=p.z-p.depth/2;z<p.z+p.depth/2;z+=1.5)box('rail sleeper',x,.018,z,2.4,.025,.2,surfaces.rail)
      }
    }
    if(p.kind!=='asphalt')continue
    const vertical=p.depth>p.width,length=vertical?p.depth:p.width,width=vertical?p.width:p.depth,runway=width>18
    for(let n=-length/2+3;n<length/2-2;n+=6){
      const x=p.x+(vertical?0:n),z=p.z+(vertical?n:0)
      if(patches.some(other=>other!==p&&other.kind==='asphalt'&&Math.abs(x-other.x)<other.width/2+1&&Math.abs(z-other.z)<other.depth/2+1))continue
      box('street lane marking',x,.025,z,vertical?.13:2.5,.012,vertical?2.5:.13,paint)
      for(const side of [-1,1])box('street edge',x+(vertical?side*(width/2-.25):0),.025,z+(vertical?0:side*(width/2-.25)),vertical?.12:5.8,.014,vertical?5.8:.12,runway?paint:yellow)
    }
    if(runway)for(const end of [-1,1])for(let stripe=-width/2+2;stripe<width/2-1;stripe+=2.3)box('runway threshold',p.x+stripe,.03,p.z+end*(length/2-12),1,.012,12,paint)
    else for(let n=-length/2+8;n<length/2-4;n+=18)for(const side of [-1,1]){
      const x=p.x+(vertical?side*(width/2+1):n),z=p.z+(vertical?n:side*(width/2+1))
      if(world.buildings.some(b=>Math.abs(x-b.x)<b.width/2+1&&Math.abs(z-b.z)<b.depth/2+1))continue
      box('street drain',x,.022,z,vertical?.45:1.2,.018,vertical?1.2:.45,steel)
    }
  }
}
