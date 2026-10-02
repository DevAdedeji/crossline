import { databaseOptions } from './connection.ts'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, desc, asc, sql } from 'drizzle-orm'
import * as schema from './schema.ts'
export interface GuestRow {id:string;tokenHash:string;displayName:string;kills:number;deaths:number}
export interface Leaders {topKills:Omit<GuestRow,'tokenHash'>[];topDeaths:Omit<GuestRow,'tokenHash'>[]}
export interface GuestRepository {
 find(hash:string):Promise<GuestRow|undefined>
 create(row:GuestRow):Promise<void>
 record(id:string,killer:string,victim:string):Promise<boolean>
 leaders():Promise<Leaders>
}
export function postgresGuestRepository(db:ReturnType<typeof drizzle<typeof schema>>):GuestRepository {
 const guests=schema.onlineGuests
 const publicFields={id:guests.id,displayName:guests.displayName,kills:guests.kills,deaths:guests.deaths}
 return {
  async find(hash){return (await db.select().from(guests).where(eq(guests.tokenHash,hash)).limit(1))[0]},
  async create(row){await db.insert(guests).values(row)},
  async record(id,killer,victim){
   if(killer===victim)return false
   return db.transaction(async tx=>{
    const inserted=await tx.insert(schema.onlineEliminations).values({id,killerId:killer,victimId:victim}).onConflictDoNothing().returning({id:schema.onlineEliminations.id})
    if(!inserted.length)return false
    await tx.update(guests).set({kills:sql`${guests.kills}+1`}).where(eq(guests.id,killer))
    await tx.update(guests).set({deaths:sql`${guests.deaths}+1`}).where(eq(guests.id,victim))
    return true
   })
  },
  async leaders(){
   const [topKills,topDeaths]=await Promise.all([
    db.select(publicFields).from(guests).orderBy(desc(guests.kills),asc(guests.deaths),asc(guests.id)).limit(10),
    db.select(publicFields).from(guests).orderBy(desc(guests.deaths),desc(guests.kills),asc(guests.id)).limit(10),
   ]);return {topKills,topDeaths}
  },
 }
}
/** Optional and lazy: constructing this module never opens a connection. */
export function openGuestDatabase(url:string) {
 const client=postgres(url,databaseOptions(url))
 return {repository:postgresGuestRepository(drizzle(client,{schema})),close:()=>client.end({timeout:5})}
}
