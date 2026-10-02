import type { Page } from '@playwright/test'
import { createTestAccount } from '../../scripts/test-account.ts'
export async function browserAccount(page:Page,name:string){
 const account=await createTestAccount('http://127.0.0.1:3001',name)
 await page.context().addCookies(account.cookie.split('; ').map(part=>{const split=part.indexOf('=');return {name:part.slice(0,split),value:part.slice(split+1),url:'http://127.0.0.1:3001',httpOnly:true,sameSite:'Lax' as const}}))
 return account
}
