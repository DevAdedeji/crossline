import nodemailer from 'nodemailer'
/** Constructing a transport does not contact an SMTP server. No production sender is enabled by default. */
export function verificationSender(env:NodeJS.ProcessEnv){
 const host=env.SMTP_HOST,user=env.SMTP_USER,password=env.SMTP_PASSWORD,from=env.AUTH_EMAIL_FROM,port=Number(env.SMTP_PORT ?? 465)
 if(env.AUTH_EMAIL_ENABLED!=='1'||!host||!user||!password||!from||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(from)||![465,587].includes(port))throw new Error('Approved verification email configuration is required')
 const transport=nodemailer.createTransport({host,port,secure:port===465,requireTLS:true,tls:{rejectUnauthorized:true},auth:{user,pass:password},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000,dnsTimeout:5000,disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false})
 return async(email:string,url:string)=>{await transport.sendMail({from,to:email,subject:'Verify your Crossline account',text:`Verify your email to enter Crossline Online:\n\n${url}\n\nThis link expires in one hour. If you did not request this, ignore this email.`})}
}
