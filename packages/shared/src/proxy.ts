// Server-only export. Never import this module into the browser game.
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
export function clientIP(value:string):string {
 const ip=value.startsWith('::ffff:')?value.slice(7):value
 if(!isIP(ip))throw new Error('A single verified client IP is required')
 return ip
}
function digest(method:string,path:string,body:string,ip:string,time:string,nonce:string,cookie:string){return JSON.stringify([method,path,createHash('sha256').update(body).digest('hex'),ip,time,nonce,createHash('sha256').update(cookie).digest('hex')])}
export function signProxy(secret:string,method:string,path:string,body:string,ip:string,cookie='',now=Date.now()) {
 if(secret.length<32)throw new Error('A strong server-only proxy secret is required')
 const time=String(now),nonce=randomUUID();ip=clientIP(ip)
 return {'x-crossline-client-ip':ip,'x-crossline-time':time,'x-crossline-nonce':nonce,'x-crossline-signature':createHmac('sha256',secret).update(digest(method,path,body,ip,time,nonce,cookie)).digest('hex')}
}
export class ProxyVerifier {
 private seen=new Map<string,number>()
 constructor(private secret:string){if(secret.length<32)throw new Error('A strong proxy secret is required')}
 verify(request:Request,body:string,now=Date.now()) {
  const h=request.headers,ip=clientIP(h.get('x-crossline-client-ip')??''),time=h.get('x-crossline-time')??'',nonce=h.get('x-crossline-nonce')??'',signature=h.get('x-crossline-signature')??''
  if(!/^\d{13}$/.test(time)||Math.abs(now-Number(time))>30000||! /^[a-f0-9-]{36}$/.test(nonce)||! /^[a-f0-9]{64}$/.test(signature))throw new Error('Invalid proxy request')
  const url=new URL(request.url),expected=createHmac('sha256',this.secret).update(digest(request.method,url.pathname+url.search,body,ip,time,nonce,h.get('cookie')??'')).digest()
  if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))throw new Error('Invalid proxy request')
  for(const [key,expires] of this.seen)if(expires<now)this.seen.delete(key)
  if(this.seen.has(nonce)||this.seen.size>=10000)throw new Error('Expired or repeated proxy request')
  this.seen.set(nonce,now+60000);return ip
 }
}
export async function boundedBody(request:Request,limit=8192):Promise<string> {
 if(Number(request.headers.get('content-length')??0)>limit)throw new Error('Request too large')
 if(!request.body)return ''
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){void reader.cancel();throw new Error('Request too large')}chunks.push(value)}}finally{reader.releaseLock()}
 return Buffer.concat(chunks).toString('utf8')
}
