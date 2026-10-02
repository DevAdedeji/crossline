export default defineEventHandler(async event=>{
 const path=getRequestURL(event).pathname
 const url=new URL(String(useRuntimeConfig(event).public.matchUrl));url.protocol=url.protocol==='wss:'?'https:':'http:'
 url.pathname=path;url.search=getRequestURL(event).search
 setResponseHeader(event,'cache-control','no-store')
 return proxyRequest(event,url.href,{fetchOptions:{redirect:'manual',signal:AbortSignal.timeout(10000)}})
})
