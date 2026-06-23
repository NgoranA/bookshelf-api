// scripts/migrate.js — create the tables if they don't exist yet.
//
// This is SAFE to run on every deploy / every boot, because schema.sql uses
// "CREATE TABLE IF NOT EXISTS". It never drops data. Use this in production.
//
//   npm run db:migrate        (locally, via .env)
//   node scripts/migrate.js   (in production, env injected by the platform)

import { readFileSync } from 'node:fs'
import { db } from '../src/db.js'

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')

await db.query(schema)
console.log('✅ Migration complete (tables are ready).')
await db.end()
