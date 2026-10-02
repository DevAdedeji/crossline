export default defineEventHandler(async(event):Promise<{roomId:string|null;full:boolean;capacity:number;seats:number}>=>{
 const url=new URL(String(useRuntimeConfig(event).public.matchUrl));url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname='/arena';url.search=''
 try{const response=await fetch(url.href,{signal:AbortSignal.timeout(3000)});if(!response.ok)throw new Error('Unavailable');return await response.json()}
 catch{throw createError({statusCode:503,statusMessage:'Arena temporarily unavailable'})}
})
