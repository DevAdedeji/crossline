import nodemailer from 'nodemailer'
/** Construction performs no network requests. Local capture remains in service.ts. */
export function verificationSender(env:NodeJS.ProcessEnv,send:typeof fetch=fetch){
 const from=env.AUTH_EMAIL_FROM
 if(env.AUTH_EMAIL_ENABLED!=='1'||!from||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(from))throw new Error('Approved verification email configuration is required')
 const content=(url:string)=>({subject:'Verify your Crossline account',text:`Verify your email to enter Crossline Online:\n\n${url}\n\nThis link expires in one hour. If you did not request this, ignore this email.`})
 if(env.AUTH_EMAIL_PROVIDER==='resend'){
  const key=env.RESEND_API_KEY
  if(!key||key.length<16)throw new Error('A server-only Resend API key is required')
  return async(email:string,url:string)=>{
   try{const response=await send('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({from,to:[email],...content(url)})});await response.body?.cancel();if(!response.ok)throw new Error('Rejected')}
   catch{throw new Error('Verification email delivery is temporarily unavailable')}
  }
 }
 if(env.AUTH_EMAIL_PROVIDER && env.AUTH_EMAIL_PROVIDER!=='smtp')throw new Error('AUTH_EMAIL_PROVIDER must be resend or smtp')
 const host=env.SMTP_HOST,user=env.SMTP_USER,password=env.SMTP_PASSWORD,port=Number(env.SMTP_PORT??465)
 if(!host||!user||!password||![465,587].includes(port))throw new Error('Approved SMTP configuration is required')
 const transport=nodemailer.createTransport({host,port,secure:port===465,requireTLS:true,tls:{rejectUnauthorized:true},auth:{user,pass:password},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000,dnsTimeout:5000,disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false})
 return async(email:string,url:string)=>{try{await transport.sendMail({from,to:email,...content(url)})}catch{throw new Error('Verification email delivery is temporarily unavailable')}}
}
