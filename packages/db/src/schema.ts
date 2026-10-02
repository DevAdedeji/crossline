import { sql } from 'drizzle-orm'
import { check, index, integer, pgEnum, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

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
