import { sql } from 'drizzle-orm'
import { bigint, boolean, text, check, index, integer, pgEnum, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

// Future modes are persistence vocabulary, not playable implementations.
export const matchMode = pgEnum('match_mode', ['training', 'solo_bots', 'free_for_all', 'squads'])
export const players = pgTable('players', {
  id: uuid().defaultRandom().primaryKey(),
  displayName: varchar('display_name', { length: 24 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [check('display_name_length', sql`char_length(${t.displayName}) between 1 and 24`)])
export const matches = pgTable('matches', {
  id: uuid().defaultRandom().primaryKey(),
  mode: matchMode().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
}, (t) => [check('match_time_order', sql`${t.endedAt} is null or ${t.endedAt} >= ${t.startedAt}`)])
export const matchPlayers = pgTable('match_players', {
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'restrict' }),
  squadNumber: integer('squad_number'),
  kills: integer().default(0).notNull(),
  deaths: integer().default(0).notNull(),
}, (t) => [primaryKey({ columns: [t.matchId, t.playerId] }), index('match_players_player_idx').on(t.playerId), check('nonnegative_stats', sql`${t.kills} >= 0 and ${t.deaths} >= 0`), check('positive_squad', sql`${t.squadNumber} is null or ${t.squadNumber} > 0`)])

// Online guests use an opaque server-issued capability; nicknames are never identity.
export const onlineGuests = pgTable('online_guests', {
  id: uuid().primaryKey(),
  tokenHash: varchar('token_hash', {length:64}).notNull().unique(),
  displayName: varchar('display_name', {length:24}).notNull(),
  kills: integer().notNull().default(0),
  deaths: integer().notNull().default(0),
  createdAt: timestamp('created_at', {withTimezone:true}).notNull().defaultNow(),
}, t=>[check('online_nonnegative_stats',sql`${t.kills} >= 0 and ${t.deaths} >= 0`),index('online_kills_idx').on(t.kills),index('online_deaths_idx').on(t.deaths)])
export const onlineEliminations = pgTable('online_eliminations', {
  id: uuid().primaryKey(),
  killerId: uuid('killer_id').notNull().references(()=>onlineGuests.id),
  victimId: uuid('victim_id').notNull().references(()=>onlineGuests.id),
  createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[check('online_distinct_players',sql`${t.killerId} <> ${t.victimId}`)])

// Better Auth owns credentials and sessions. Public match data never joins email fields.
export const user = pgTable('auth_user', {
 id:text().primaryKey(), name:text().notNull(), email:text().notNull().unique(),
 emailVerified:boolean('email_verified').notNull().default(false), image:text(),
 username:varchar({length:16}).notNull().unique(), displayUsername:varchar('display_username',{length:16}),
 createdAt:timestamp('created_at').notNull().defaultNow(), updatedAt:timestamp('updated_at').notNull().defaultNow(),
},t=>[check('auth_username_format',sql`${t.username} ~ '^[a-z0-9_]{3,16}$'`)])
export const session = pgTable('auth_session', {
 id:text().primaryKey(),token:text().notNull().unique(),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
 expiresAt:timestamp('expires_at').notNull(),ipAddress:text('ip_address'),userAgent:text('user_agent'),
 createdAt:timestamp('created_at').notNull().defaultNow(),updatedAt:timestamp('updated_at').notNull().defaultNow(),
},t=>[index('auth_session_user_idx').on(t.userId)])
export const account = pgTable('auth_account', {
 id:text().primaryKey(),accountId:text('account_id').notNull(),providerId:text('provider_id').notNull(),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
 password:text(),accessToken:text('access_token'),refreshToken:text('refresh_token'),idToken:text('id_token'),scope:text(),
 accessTokenExpiresAt:timestamp('access_token_expires_at'),refreshTokenExpiresAt:timestamp('refresh_token_expires_at'),
 createdAt:timestamp('created_at').notNull().defaultNow(),updatedAt:timestamp('updated_at').notNull().defaultNow(),
},t=>[index('auth_account_user_idx').on(t.userId)])
export const verification = pgTable('auth_verification', {
 id:text().primaryKey(),identifier:text().notNull(),value:text().notNull(),expiresAt:timestamp('expires_at').notNull(),
 createdAt:timestamp('created_at').notNull().defaultNow(),updatedAt:timestamp('updated_at').notNull().defaultNow(),
},t=>[index('auth_verification_identifier_idx').on(t.identifier)])
export const rateLimit = pgTable('auth_rate_limit', {id:text().primaryKey(),key:text().notNull().unique(),count:integer().notNull(),lastRequest:bigint('last_request',{mode:'number'}).notNull()})
export const accountStats = pgTable('account_stats', {
 userId:text('user_id').primaryKey().references(()=>user.id,{onDelete:'cascade'}),
 kills:integer().notNull().default(0),deaths:integer().notNull().default(0),
},t=>[check('account_nonnegative_stats',sql`${t.kills} >= 0 and ${t.deaths} >= 0`),index('account_kills_idx').on(t.kills),index('account_deaths_idx').on(t.deaths)])
export const accountEliminations = pgTable('account_eliminations', {
 id:uuid().primaryKey(),killerId:text('killer_id').notNull().references(()=>user.id),victimId:text('victim_id').notNull().references(()=>user.id),
 createdAt:timestamp('created_at').notNull().defaultNow(),
},t=>[check('account_distinct_players',sql`${t.killerId} <> ${t.victimId}`)])
