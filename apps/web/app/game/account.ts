import { createAuthClient } from 'better-auth/vue'
import { usernameClient, oneTimeTokenClient } from 'better-auth/client/plugins'
export const authClient=createAuthClient({plugins:[usernameClient(),oneTimeTokenClient()]})
export async function currentAccount(){const {data}=await authClient.getSession();return data?.user.emailVerified?{id:data.user.id,username:data.user.username}:null}
export async function onlineJoinToken(){const {data,error}=await authClient.oneTimeToken.generate();if(error||!data?.token)throw new Error('Sign in again to enter Online.');return data.token}
