export default defineEventHandler(event=>{
 const path=getRequestURL(event).pathname.slice('/api/match'.length)
 if(event.method!=='POST'||!/^\/matchmake\/(joinOrCreate|create|join|joinById|reconnect)\/[a-zA-Z0-9_-]+$/.test(path))throw createError({statusCode:404,statusMessage:'Unavailable'})
 return matchProxy(event,path)
})
