import type { Building, Solid } from './urban-map.ts'
export const LANDMARK_BUILDINGS:Building[]=[
 {id:'ironworks',name:'NORTH IRONWORKS / FACTORY',x:0,z:48,width:34,depth:26,height:8,material:'brick',doors:['south','north','east','west']},
 {id:'foundry-tower',name:'FOUNDRY / OPERATIONS',x:48,z:48,width:14,depth:16,height:12.8,material:'concrete',doors:['south','east']},
]
export const LANDMARK_SOLIDS:Solid[]=[]
export const LANDMARK_NAV:{x:number;y:number;z:number}[]=[]
function box(id:string,x:number,y:number,z:number,width:number,height:number,depth:number,material:Solid['material']='metal'){
 LANDMARK_SOLIDS.push({id:`landmark-${id}`,x,y,z,width,height,depth,material})
}
function wall(id:string,x:number,z:number,length:number,bottom:number,height:number,horizontal:boolean,opening?:{at:number;width:number;height:number},material:Solid['material']='brick'){
 const part=(tag:string,offset:number,w:number,y:number,h:number)=>box(`${id}-${tag}`,x+(horizontal?offset:0),y,z+(horizontal?0:offset),horizontal?w:.4,h,horizontal?.4:w,material)
 if(!opening){part('solid',0,length,bottom+height/2,height);return}
 const left=opening.at-opening.width/2+length/2,right=length/2-opening.at-opening.width/2
 if(left>0)part('left',-length/2+left/2,left,bottom+height/2,height)
 if(right>0)part('right',length/2-right/2,right,bottom+height/2,height)
 if(height>opening.height)part('lintel',opening.at,opening.width,bottom+(height+opening.height)/2,height-opening.height)
}
function stairs(id:string,x:number,fromZ:number,toZ:number,bottom:number,top:number,width:number){
 const count=Math.round((top-bottom)/.2),run=(toZ-fromZ)/count
 for(let i=0;i<count;i++){const h=(i+1)*(top-bottom)/count;box(`${id}-step-${i}`,x,bottom+h/2,fromZ+run*(i+.5),width,h,Math.abs(run)+.002,'concrete')}
 LANDMARK_NAV.push({x,y:(bottom+top)/2,z:fromZ+run*(count/2-.5)})
 LANDMARK_NAV.push({x,y:bottom,z:fromZ-Math.sign(run)*.6},{x,y:top,z:toZ+Math.sign(run)*.6})
}
// 34m-wide, 8m-high factory: open loading bays, machinery, north mezzanine, two stair flights and roof hatch.
wall('factory-south',0,35,34,0,8,true,{at:0,width:6,height:4.3})
wall('factory-north',0,61,34,0,8,true,{at:0,width:4,height:3.2})
wall('factory-west',-17,48,26,0,8,false,{at:0,width:4,height:3.2})
wall('factory-east',17,48,26,0,8,false,{at:0,width:4,height:3.2})
box('factory-mezzanine',0,3.85,58,33.2,.3,5.6,'concrete')
// Roof slabs leave a real stair opening above the west flight.
box('factory-roof-main',2,7.85,48,29.6,.3,26.4,'roof')
box('factory-roof-west-front',-14.9,7.85,39,3.8,.3,8.4,'roof')
box('factory-roof-west-back',-14.9,7.85,59.2,3.8,.3,4,'roof')
stairs('factory-mezz-stair',13,44.5,54.5,0,4,3)
box('factory-mezz-stair-landing',13,3.85,55.5,3,.3,2,'concrete')
stairs('factory-roof-stair',-14,55.5,45.5,4,8,3)
box('factory-roof-stair-landing',-14,7.85,44.4,3,.3,2.2,'roof')
for(const x of [-15.5,15.5])for(const z of [38,48,59])box(`factory-column-${x}-${z}`,x,3.8,z,.5,7.6,.5,'metal')
for(const [i,p] of [[-8,44],[6,48],[-7,52]].entries()){
 const [x,z]=p;box(`factory-machine-${i}`,x!,1.2,z!,4,2.4,3,'metal')
 box(`factory-machine-top-${i}`,x!,2.65,z!,2.8,.5,2.2,'concrete')
}
box('factory-crane',0,5.8,46,22,.6,.8,'metal')
box('factory-hoist',1,5,46,1.5,1,.9,'metal')
for(const x of [-12,-4,4,12])box(`factory-roof-vent-${x}`,x,8.7,58,2.2,1.4,1.8,'metal')
box('factory-chimney',-12,8,38,1.8,16,1.8,'brick')
for(const [x,z,w,d] of [[0,34.9,34,.25],[0,61.1,34,.25],[-17.1,48,.25,26],[17.1,48,.25,26]])box(`factory-parapet-${x}-${z}`,x!,8.45,z!,w!,.9,d!,'concrete')
for(const x of [-10,-4,3,10])LANDMARK_NAV.push({x,y:4,z:58},{x,y:8,z:40},{x,y:8,z:52})
LANDMARK_NAV.push({x:13,y:4,z:58},{x:-14,y:4,z:58},{x:-14,y:8,z:42},{x:0,y:0,z:34},{x:0,y:0,z:38},{x:0,y:0,z:62})
// Four-storey operations building. Every floor connects to a switchback external stair, not a sealed facade.
for(let floor=0;floor<4;floor++){
 const y=floor*3.2,eastDoor=floor%2===0?-6.5:6
 wall(`tower-${floor}-south`,48,40,14,y,3.2,true,floor===0?{at:0,width:3,height:2.6}:undefined,'concrete')
 wall(`tower-${floor}-north`,48,56,14,y,3.2,true,undefined,'concrete')
 wall(`tower-${floor}-west`,41,48,16,y,3.2,false,undefined,'concrete')
 wall(`tower-${floor}-east`,55,48,16,y,3.2,false,{at:eastDoor,width:2.6,height:2.6},'concrete')
 if(floor>0)box(`tower-floor-${floor}`,48,y-.15,48,14,.3,16,'concrete')
 box(`tower-desk-${floor}`,44.5,y+.55,47,2.5,1.1,1.2,'wood')
 box(`tower-cabinet-${floor}`,51.5,y+1.05,44,1.2,2.1,1,'metal')
 for(const x of [44,48,52])for(const z of [42,48,54])LANDMARK_NAV.push({x,y,z})
 const from=floor%2===0?38:56,to=floor%2===0?55:39,x=floor%2===0?57.5:60.5
 stairs(`tower-flight-${floor}`,x,from,to,y,y+3.2,2.6)
 const end=floor%2===0?55.6:38.6
 box(`tower-landing-${floor}`,58.2,y+3.05,end,8.8,.3,2,'metal')
 box(`tower-landing-rail-${floor}`,62.55,y+3.75,end,.12,1.1,2,'metal')
 box(`tower-door-landing-${floor}`,55,y+3.05,floor%2===0?54.7:40.5,2.4,.3,3.6,'metal')
 LANDMARK_NAV.push({x:57.5,y:y+3.2,z:end},{x:60.5,y:y+3.2,z:end},{x:54,y:y+3.2,z:floor%2===0?54:41.5})
}
for(const z of [39,55])box(`tower-stair-support-${z}`,62.3,6.4,z,.3,12.8,.3,'metal')
box('tower-roof',48,12.65,48,14.4,.3,16.4,'roof')
for(const [x,z,w,d] of [[48,39.8,14.4,.3],[48,56.2,14.4,.3],[40.8,48,.3,16.4],[55.2,49.7,.3,12.7]])box(`tower-roof-parapet-${x}-${z}`,x!,13.25,z!,w!,.9,d!,'concrete')
for(const [x,z] of [[45,45],[51,51]])box(`tower-roof-plant-${x}`,x!,13.5,z!,2,1.4,2,'metal')
LANDMARK_NAV.push({x:48,y:12.8,z:48},{x:53,y:12.8,z:41.5},{x:48,y:0,z:38},{x:57.5,y:0,z:37})
export const LANDMARK_SPAWNS=[{x:0,y:4,z:58},{x:0,y:8,z:45},{x:48,y:3.2,z:48},{x:48,y:9.6,z:48},{x:48,y:12.8,z:48}]

// Compact hospital district: connected wards, central corridor, three floors and accessible roof.
LANDMARK_BUILDINGS.push({id:'mercer-hospital',name:'MERCER / HOSPITAL',x:-48,z:-48,width:30,depth:26,height:9.6,material:'plaster',doors:['south','north','east']})
for(let floor=0;floor<3;floor++) {
 const y=floor*3.2,doorZ=floor%2===0?-11:11
 wall(`hospital-${floor}-south`,-48,-61,30,y,3.2,true,floor===0?{at:0,width:5,height:2.6}:undefined,'plaster')
 wall(`hospital-${floor}-north`,-48,-35,30,y,3.2,true,floor===0?{at:0,width:4,height:2.6}:undefined,'plaster')
 wall(`hospital-${floor}-west`,-63,-48,26,y,3.2,false,undefined,'plaster')
 wall(`hospital-${floor}-east`,-33,-48,26,y,3.2,false,{at:doorZ,width:3,height:2.6},'plaster')
 if(floor>0)box(`hospital-floor-${floor}`,-48,y-.15,-48,30,.3,26,'concrete')
 // Two open wards on each side of a six-metre corridor. No decorative sealed entrances.
 for(const side of [-1,1]) {
  wall(`hospital-${floor}-ward-${side}`,-48+side*3.4,-48,24,y,3,false,{at:0,width:3,height:2.5},'plaster')
  for(const dz of [-7,7]) {
   const x=-48+side*9,z=-48+dz
   box(`hospital-bed-${floor}-${side}-${dz}`,x,y+.38,z,1.1,.76,2.2,'metal')
   box(`hospital-mattress-${floor}-${side}-${dz}`,x,y+.83,z,1.1,.14,2.2,'plaster')
   box(`hospital-bedhead-${floor}-${side}-${dz}`,x,y+1.1,z+1,1.2,.6,.12,'metal')
   box(`hospital-locker-${floor}-${side}-${dz}`,x+side*3,y+.9,z,1.1,1.8,.8,'metal')
  }
  for(const z of [-58,-48,-38])LANDMARK_NAV.push({x:-48+side*6,y,z},{x:-48+side*12,y,z})
 }
 box(`hospital-nurses-${floor}`,-48,y+.5,-39.5,2,1,1.4,'wood')
 for(const z of [-59,-54,-48,-42,-37])LANDMARK_NAV.push({x:-48,y,z},{x:-34.5,y,z})
 const ascending=floor%2===0,from=ascending?-64:-32,to=ascending?-33:-63,x=ascending?-30.5:-27.5
 // 31m walking flight: intermediate navigation nodes make each edge shorter than 18m.
 const steps=16,run=(to-from)/steps
 for(let i=0;i<steps;i++)box(`hospital-flight-${floor}-${i}`,x,y+(i+1)*.1,from+run*(i+.5),2.5,(i+1)*.2,Math.abs(run)+.002,'concrete')
 const sign=ascending?1:-1
 LANDMARK_NAV.push({x,y,z:from-sign*.6},{x,y:y+1.6,z:from+run*7.5},{x,y:y+3.2,z:to+sign*.6})
 const end=to+sign*.3
 box(`hospital-landing-${floor}`,-30,y+3.05,end,9,.3,3.8,'metal')
 LANDMARK_NAV.push({x:-30.5,y:y+3.2,z:end},{x:-27.5,y:y+3.2,z:end},{x:-34.5,y:y+3.2,z:ascending?-37:-59})
 LANDMARK_NAV.push({x:-32.28,y:y+3.2,z:end},{x:-32.28,y:y+3.2,z:ascending?-37:-59})
 // Wide raised walkway joins the stair landing to each floor door.
 box(`hospital-doorway-landing-${floor}`,-33.5,y+3.05,ascending?-35.5:-60.5,3,.3,5,'metal')
}
box('hospital-roof',-48,9.45,-48,30.4,.3,26.4,'roof')
for(const [x,z,w,d] of [[-48,-61.2,30,.25],[-48,-34.8,30,.25],[-63.2,-48,.25,26],[-32.8,-49.5,.25,22]])box(`hospital-parapet-${x}-${z}`,x!,10.05,z!,w!,.9,d!,'concrete')
box('hospital-canopy',-48,3.05,-63,12,.3,5,'metal')
for(const x of [-53.5,-42.5])box(`hospital-canopy-post-${x}`,x,1.5,-65,.2,3,.2,'metal')
for(const x of [-58,-38])box(`hospital-roof-plant-${x}`,x,10.3,-48,2.2,1.4,3,'metal')
LANDMARK_NAV.push({x:-48,y:0,z:-66},{x:-48,y:0,z:-62},{x:-48,y:0,z:-34},{x:-30.5,y:0,z:-65},{x:-48,y:9.6,z:-48},{x:-34.5,y:9.6,z:-37})
LANDMARK_SPAWNS.push({x:-48,y:0,z:-48},{x:-54,y:3.2,z:-48},{x:-48,y:6.4,z:-48},{x:-48,y:9.6,z:-48})
