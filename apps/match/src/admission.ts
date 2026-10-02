import { ProxyVerifier, boundedBody } from '@crossline/shared/proxy'
/** Bounded process-local defense; the single match process owns all rooms. */
export class AdmissionLimit {
 private buckets=new Map<string,{count:number;until:number}>()
 constructor(private limit=30,private windowMs=60000,private maxKeys=10000){}
 accept(ip:string,now=Date.now()){
  for(const [key,value] of this.buckets)if(value.until<=now)this.buckets.delete(key)
  const existing=this.buckets.get(ip)
  if(existing){if(existing.count>=this.limit)return false;existing.count++;return true}
  if(this.buckets.size>=this.maxKeys)return false
  this.buckets.set(ip,{count:1,until:now+this.windowMs});return true
 }
}
export function requestGuard(config:{production:boolean;origin:string},secret?:string){
 const verifier=config.production?new ProxyVerifier(secret??''):undefined,admission=new AdmissionLimit()
 return async(request:Request)=>{
  const path=new URL(request.url).pathname,origin=request.headers.get('origin')
  if(origin && origin!==config.origin)return Response.json({message:'Forbidden'},{status:403})
  if(path==='/health'||path==='/__healthcheck'||path==='/arena'||path==='/leaderboard')return
  if(!path.startsWith('/api/auth/')&&!path.startsWith('/matchmake/'))return Response.json({message:'Unavailable'},{status:404})
  let body:string
  try{body=await boundedBody(request)}catch{return Response.json({message:'Request too large'},{status:413})}
  let ip='127.0.0.1'
  try{if(verifier)ip=verifier.verify(request,body)}catch{return Response.json({message:'Forbidden'},{status:403})}
  if(path.startsWith('/matchmake/')&&!admission.accept(ip))return Response.json({message:'Too many join attempts'},{status:429})
  const headers=new Headers(request.headers)
  // The auth adapter and Colyseus receive only an authenticated identity for this hop.
  for(const name of ['x-forwarded-for','x-real-ip','forwarded','authorization'])headers.delete(name)
  headers.set('x-crossline-client-ip',ip)
  return new Request(request.url,{method:request.method,headers,...(body?{body}:{})})
 }
}
export class GuestBudget {
 private rooms=new Set<string>()
 private ips=new Map<string,Set<string>>()
 constructor(readonly maxRooms=4,readonly perIP=2){}
 reserve(id:string){if(this.rooms.size>=this.maxRooms)throw new Error('Guest rooms are busy. Try again shortly.');this.rooms.add(id)}
 attach(id:string,ip:string){const rooms=this.ips.get(ip)??new Set<string>();if(rooms.size>=this.perIP)throw new Error('Close another Solo or Practice session first.');rooms.add(id);this.ips.set(ip,rooms)}
 release(id:string){this.rooms.delete(id);for(const [ip,rooms] of this.ips){rooms.delete(id);if(!rooms.size)this.ips.delete(ip)}}
 get size(){return this.rooms.size}
}
export const guestBudget=new GuestBudget()
