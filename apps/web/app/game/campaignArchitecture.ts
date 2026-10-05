import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import type { WorldGeometry } from '@crossline/shared'
import { buildingFinishIndex } from './buildingFinishes'

type Box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,surface:PBRMaterial)=>Mesh
type Material=(name:string,color:string)=>PBRMaterial

/** Rooflines, storefronts and service fittings are batched with the shared building shells. */
export function campaignArchitecture(world:WorldGeometry,box:Box,material:Material){
  if(world.legacyRamp!==false&&!world.place)return
  const trim=material('architecture stone','#b4ac96'),steel=material('architecture iron','#354448')
  const roofs=['#895544','#74694f','#526569'].map((color,i)=>material(`architecture clay ${i}`,color)),roofMetal=material('architecture roof','#485c65')
  const glass=material('architecture glazing','#355364'),light=material('architecture light','#e8d6a7')
  glass.roughness=.25;glass.metallic=.3
  const awnings=['#3e7779','#9e5948','#a38743'].map((c,i)=>material(`shop awning ${i}`,c))
  for(const b of world.buildings){
    const h=b.height??3.8,w=b.width,d=b.depth,tone=buildingFinishIndex(b.id)
    const kind=b.architecture??(world.id==='hill-village'?'house':/store|armoury|repair/.test(b.id)?'hall':'workshop')
    if(kind==='tower')continue
    if(kind==='house')for(const face of ['north','south','east','west'] as const){
      const horizontal=face==='north'||face==='south',side=face==='north'||face==='east'?1:-1
      for(const offset of [-1,1]){
        const x=b.x+(horizontal?offset*w*.31:side*(w/2+.23)),z=b.z+(horizontal?side*(d/2+.23):offset*d*.29)
        box('cottage window',x,1.7,z,horizontal?1.15:.06,1.3,horizontal?.06:1.15,glass)
        box('cottage sill',x,1.02,z,horizontal?1.3:.24,.12,horizontal?.24:1.3,trim)
        box('window crossbar',x+(horizontal?0:side*.05),1.7,z+(horizontal?side*.05:0),horizontal?1.15:.06,.06,horizontal?.06:1.15,trim)
      }
    }
    if(kind==='ruin'){
      const timber=material('charred timber','#383a31'),board=material('wood','#977a4e')
      for(let offset=-w/2+2;offset<w/2;offset+=3.5)box('exposed roof joist',b.x+offset,h+.18,b.z,.18,.23,d,timber)
      for(const side of [-1,1])for(let offset=-w/2+2;offset<w/2-1;offset+=4){
        if(Math.abs(offset)<3)continue
        box('abandoned window recess',b.x+offset,1.9,b.z+side*(d/2+.23),1.65,1.65,.045,timber)
        for(const level of [-1,1]){const plank=box('boarded window',b.x+offset,1.9+level*.45,b.z+side*(d/2+.28),1.9,.21,.09,board);plank.rotation.z=level*.16}
      }
      continue
    }
    if(kind==='terminal'){
      for(const side of [-1,1]){
        for(let offset=-w/2+.5;offset<w/2;offset+=2.6){
          if(Math.abs(offset)<(b.doorWidth??3)/2+.3)continue
          box('terminal glass mullion',b.x+offset,h/2,b.z+side*(d/2+.24),.09,h,.12,trim)
        }
        box('terminal cantilever',b.x,h+.6,b.z+side*(d/2+1.8),w+3,.35,4,trim)
        box('terminal transom',b.x,h*.6,b.z+side*(d/2+.25),w,.13,.1,trim)
      }
    }
    if(kind==='apartment'||kind==='terrace')for(let floor=1;floor<h/3.2;floor++)for(const side of [-1,1]){
      box('storey band',b.x,floor*3.2,b.z+side*(d/2+.29),w+.2,.17,.25,trim)
      for(let offset=-w/2+3;offset<w/2-1;offset+=6){
        box('balcony slab',b.x+offset,floor*3.2,b.z+side*(d/2+.6),3.7,.15,1.4,trim)
        box('balcony rail',b.x+offset,floor*3.2+.8,b.z+side*(d/2+1.25),3.7,.08,.08,steel)
        for(const end of [-1,0,1])box('balcony baluster',b.x+offset+end*1.6,floor*3.2+.4,b.z+side*(d/2+1.25),.06,.8,.06,steel)
      }
    }
    if(kind==='station'){
      box('civic pediment',b.x,h+1,b.z-d/2,w*.55,1.5,.6,trim)
      for(const offset of [-.42,-.28,.28,.42])box('civic pilaster',b.x+w*offset,h/2,b.z-d/2-.12,.6,h,.45,trim)
      box('station portico',b.x,3.5,b.z-d/2-1.1,w,.25,2.5,trim)
    }
    if(kind==='hangar'){
      // A bowed hangar silhouette is built from shallow roof sections.
      for(let segment=0;segment<12;segment++){
        const a=-Math.PI/2+segment*Math.PI/12,beta=a+Math.PI/12
        const x1=Math.sin(a)*w/2,x2=Math.sin(beta)*w/2,y1=Math.cos(a)*3,y2=Math.cos(beta)*3
        const panel=box('curved hangar roof',b.x+(x1+x2)/2,h+.3+(y1+y2)/2,b.z,Math.hypot(x2-x1,y2-y1)+.05,.16,d+1,roofMetal)
        panel.rotation.z=Math.atan2(y2-y1,x2-x1)
      }
    }
    // Narrow plinths and pilasters lie directly against physical walls.
    for(const side of [-1,1]){
      for(const end of [-1,1])box('masonry corner',b.x+side*(w/2+.04),h/2,b.z+end*(d/2+.25),.24,h,.24,trim)
      box('roof cornice',b.x,h+.18,b.z+side*(d/2+.18),w+.7,.25,.32,trim)
      box('side cornice',b.x+side*(w/2+.18),h+.18,b.z,.32,.25,d+.7,trim)
      const segment=(w-(b.doorWidth??3))/2
      for(const end of [-1,1])box('masonry plinth',b.x+end*((b.doorWidth??3)/2+segment/2),.2,b.z+side*(d/2+.24),segment,.4,.12,trim)
    }
    if(kind==='house'||kind==='terrace'||kind==='hall'||kind==='workshop'){
      const rise=kind==='hall'?2:1.7,half=w/2+.5,slope=Math.atan2(rise,half)
      for(const side of [-1,1]){
        const panel=box('pitched roof',b.x+side*half/2,h+.36+rise/2,b.z,Math.hypot(half,rise),.16,d+1,kind==='house'||kind==='terrace'?roofs[tone%3]!:roofMetal)
        panel.rotation.z=-side*slope
      }
      for(const end of [-1,1]){
        const gable=new Mesh('gable masonry',box('gable backing',b.x,h+.3,b.z+end*d/2,w,.02,.25,trim).getScene()),data=new VertexData()
        data.positions=[-w/2,0,0,0,rise,0,w/2,0,0];data.indices=end>0?[0,1,2]:[2,1,0];data.normals=[];data.uvs=[0,0,.5,1,1,0]
        VertexData.ComputeNormals(data.positions,data.indices,data.normals);data.applyToMesh(gable)
        gable.position.set(b.x,h+.3,b.z+end*d/2);gable.material=trim;gable.freezeWorldMatrix()
      }
      box('roof ridge flashing',b.x,h+.4+rise,b.z,.22,.16,d+1.1,steel)
      if(kind==='house'){
        box('chimney brickwork',b.x+w*.28,h+2,b.z+d*.2,.85,2.5,.85,material('brick','#985d46'))
        box('chimney coping',b.x+w*.28,h+3.3,b.z+d*.2,1,.16,1,trim)
      }
    }else if(kind!=='hangar'){
      // Flat-roof shops and clinics get a parapet, rooftop services and a canopy.
      for(const side of [-1,1]){
        box('roof parapet',b.x,h+.6,b.z+side*d/2,w,.7,.25,trim)
        box('roof parapet',b.x+side*w/2,h+.6,b.z,.25,.7,d,trim)
      }
      box('roof ventilation',b.x+w*.25,h+.7,b.z+d*.2,1.6,.8,1.3,steel)
      for(let n=-2;n<=2;n++)box('vent grille',b.x+w*.25+n*.25,h+1.12,b.z+d*.2,.08,.035,1.1,trim)
    }
    for(const door of b.doors){
      const horizontal=door==='south'||door==='north',side=door==='north'||door==='east'?1:-1
      const x=b.x+(horizontal?0:side*(w/2+.22)),z=b.z+(horizontal?side*(d/2+.22):0),opening=b.doorWidth??3
      const height=h>5&&(!b.architecture||b.architecture==='hall'||b.architecture==='hangar')?4.8:3
      const canopy=kind==='shop'||kind==='clinic'?awnings[tone%3]!:roofMetal
      box('entrance canopy',x+(horizontal?0:side*.8),height+.18,z+(horizontal?side*.8:0),horizontal?opening+1.5:1.7,.16,horizontal?1.7:opening+1.5,canopy)
      box('entrance light',x+(horizontal?opening/2+.35:side*.1),2.6,z+(horizontal?side*.1:opening/2+.35),.18,.25,.18,light)
      if(kind==='shop')for(const end of [-1,1]){
        const xx=x+(horizontal?end*(opening/2+1.7):side*.07),zz=z+(horizontal?side*.07:end*(opening/2+1.7))
        box('shopfront sill',xx,.65,zz,horizontal?2.3:.12,.12,horizontal?.12:2.3,trim)
        box('shopfront glass',xx,1.65,zz,horizontal?2.2:.08,1.85,horizontal?.08:2.2,glass)
        box('shopfront mullion',xx,1.65,zz+(horizontal?side*.06:0),horizontal?.07:.12,1.85,horizontal?.12:.07,steel)
      }
      if(kind==='clinic'){
        const xx=x+(horizontal?opening/2+.8:side*.12),zz=z+(horizontal?side*.12:opening/2+.8)
        box('medical emblem',xx,2,zz,horizontal?.8:.08,.22,horizontal?.08:.8,light)
        box('medical emblem',xx,2,zz,horizontal?.22:.08,.8,horizontal?.08:.22,light)
      }
    }
    // Wall-mounted services give sides and interiors a purpose without narrowing routes.
    box('service meter',b.x+w/2+.23,1.4,b.z+d*.25,.18,.7,.5,steel)
    box('service conduit',b.x+w/2+.25,h/2,b.z+d*.25,.06,h,.06,steel)
    box('interior ceiling fitting',b.x,h-.12,b.z,1.8,.08,.35,light)
  }
}
