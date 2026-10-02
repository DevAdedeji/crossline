export default defineEventHandler(event=>matchProxy(event,getRequestURL(event).pathname))
