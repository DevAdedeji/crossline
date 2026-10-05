import { PGlite } from '@electric-sql/pglite'
import { drizzle as embedded } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { databaseOptions } from './connection.ts'
import { mkdir } from 'node:fs/promises'
import { eq, desc, asc, sql } from 'drizzle-orm'
import * as schema from './schema.ts'
export async function openAccountDatabase(options:{localPath?:string;url?:string;migrations:string}) {
 if(options.localPath){
  if(options.localPath!==':memory:')await mkdir(options.localPath,{recursive:true,mode:0o700})
  const client=new PGlite(options.localPath===':memory:'?undefined:options.localPath),db=embedded(client,{schema})
  try{await migrate(db,{migrationsFolder:options.migrations})}catch(error){await client.close();throw error}
  return {db:db as unknown as ReturnType<typeof drizzle<typeof schema>>,close:()=>client.close(),local:true}
 }
 if(!options.url)throw new Error('Account database is not configured')
 const client=postgres(options.url,databaseOptions(options.url))
 return {db:drizzle(client,{schema}),close:()=>client.end({timeout:5}),local:false}
}
export class AccountStatistics {
 private pending=new Map<string,{killer:string;victim:string}>()
 private flushing=false
 private failed=false
 constructor(readonly db:ReturnType<typeof drizzle<typeof schema>>){}
 async ensure(userId:string){await this.db.insert(schema.accountStats).values({userId}).onConflictDoNothing()}
 async record(id:string,killerId:string,victimId:string){
  return this.db.transaction(async tx=>{
   const inserted=await tx.insert(schema.accountEliminations).values({id,killerId,victimId}).onConflictDoNothing().returning({id:schema.accountEliminations.id})
   if(!inserted.length)return false
   if(killerId!==victimId)await tx.update(schema.accountStats).set({kills:sql`${schema.accountStats.kills}+1`}).where(eq(schema.accountStats.userId,killerId))
   await tx.update(schema.accountStats).set({deaths:sql`${schema.accountStats.deaths}+1`}).where(eq(schema.accountStats.userId,victimId))
   return true
  })
 }
 enqueue(id:string,killer:string,victim:string){if(this.pending.size>=1000){this.failed=true;return}this.pending.set(id,{killer,victim});void this.flush()}
 async flush(){if(this.flushing)return;this.flushing=true;try{for(const [id,v] of this.pending){await this.record(id,v.killer,v.victim);this.pending.delete(id)}this.failed=false}catch{this.failed=true}finally{this.flushing=false}}
 async leaderboard(){
  const t=schema.accountStats,u=schema.user,fields={id:u.id,displayName:u.username,kills:t.kills,deaths:t.deaths}
  const [topKills,topDeaths]=await Promise.all([
   this.db.select(fields).from(t).innerJoin(u,eq(t.userId,u.id)).orderBy(desc(t.kills),asc(t.deaths),asc(u.id)).limit(10),
   this.db.select(fields).from(t).innerJoin(u,eq(t.userId,u.id)).orderBy(desc(t.deaths),desc(t.kills),asc(u.id)).limit(10),
  ])
  return {topKills,topDeaths,durable:true,delayed:this.failed||this.pending.size>0}
 }
}
