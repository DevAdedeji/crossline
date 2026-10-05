import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import type { WorldGeometry } from '@crossline/shared'
import { buildingFinishIndex } from './buildingFinishes'

type Box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,surface:PBRMaterial)=>Mesh
type Material=(name:string,color:string)=>PBRMaterial

/** Rooflines, storefronts and service fittings are batched with the shared building shells. */
export function campaignArchitecture(world:WorldGeometry,box:Box,material:Material){
  if(world.legacyRamp!==false)return
  const trim=material('architecture stone','#b4ac96'),steel=material('architecture iron','#354448')
  const roof=material('architecture clay','#895544'),roofMetal=material('architecture roof','#485c65')
  const glass=material('architecture glazing','#355364'),light=material('architecture light','#e8d6a7')
  glass.roughness=.25;glass.metallic=.3
  const awnings=['#3e7779','#9e5948','#a38743'].map((c,i)=>material(`shop awning ${i}`,c))
  for(const b of world.buildings){
    const h=b.height??3.8,w=b.width,d=b.depth,tone=buildingFinishIndex(b.id)
    const kind=b.architecture??(world.id==='hill-village'?'house':/store|armoury|repair/.test(b.id)?'hall':'workshop')
    if(world.environment==='airfield'&&b.id.endsWith('-north'))continue
    // Narrow plinths and pilasters lie directly against physical walls.
    for(const side of [-1,1]){
      for(const end of [-1,1])box('masonry corner',b.x+side*(w/2+.04),h/2,b.z+end*(d/2+.04),.24,h,.24,trim)
      box('roof cornice',b.x,h+.18,b.z+side*(d/2+.18),w+.7,.25,.32,trim)
      box('side cornice',b.x+side*(w/2+.18),h+.18,b.z,.32,.25,d+.7,trim)
      const segment=(w-(b.doorWidth??3))/2
      for(const end of [-1,1])box('masonry plinth',b.x+end*((b.doorWidth??3)/2+segment/2),.2,b.z+side*(d/2+.03),segment,.4,.12,trim)
    }
    if(kind==='house'||kind==='hall'||kind==='workshop'){
      const rise=kind==='hall'?2:1.7,half=w/2+.5,slope=Math.atan2(rise,half)
      for(const side of [-1,1]){
        const panel=box('pitched roof',b.x+side*half/2,h+.36+rise/2,b.z,Math.hypot(half,rise),.16,d+1,kind==='house'?roof:roofMetal)
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
    }else{
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
      const x=b.x+(horizontal?0:side*w/2),z=b.z+(horizontal?side*d/2:0),opening=b.doorWidth??3
      const height=h>5&&(!b.architecture||b.architecture==='hall')?4.8:3
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
    box('service meter',b.x+w/2+.08,1.4,b.z+d*.25,.18,.7,.5,steel)
    box('service conduit',b.x+w/2+.09,h/2,b.z+d*.25,.06,h,.06,steel)
    box('interior ceiling fitting',b.x,h-.12,b.z,1.8,.08,.35,light)
  }
}
