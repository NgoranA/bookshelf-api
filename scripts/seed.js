// scripts/seed.js — insert the sample rows from db/seed.sql.
//
// Run this once after migrating a fresh database. Running it repeatedly will
// insert duplicate rows — for a clean slate use `npm run db:reset` instead.

import { readFileSync } from 'node:fs'
import { db } from '../src/db.js'

const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8')

await db.query(seed)
console.log('✅ Seed complete (sample books and reviews inserted).')
await db.end()
