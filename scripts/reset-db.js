// scripts/reset-db.js — wipe and rebuild the database from scratch.
//
//   DROP everything  →  re-CREATE tables  →  re-INSERT seed data
//
// This gives a deterministic, known starting point. We use it for local
// development (`npm run db:reset`) and automatically before tests (`pretest`).
//
// ⚠️  It DROPS TABLES. Never point this at a production database.

import { readFileSync } from 'node:fs'
import { db } from '../src/db.js'

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8')

await db.query('DROP TABLE IF EXISTS reviews, books, users CASCADE')
await db.query(schema)
await db.query(seed)

console.log('✅ Database reset (dropped, recreated, and seeded).')
await db.end()
