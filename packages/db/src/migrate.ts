import { existsSync } from 'node:fs'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { databaseOptions } from './connection.ts'
if (existsSync('.env')) process.loadEnvFile()
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required for an explicitly requested migration')
const client = postgres(url, databaseOptions(url))
try {
  await migrate(drizzle(client), {
    migrationsFolder: new URL('../drizzle', import.meta.url).pathname,
  })
  console.info('Migrations complete')
} finally {
  await client.end({ timeout: 5 })
}
