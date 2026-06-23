import { readFileSync } from 'node:fs';
import { db } from '../src/config/db.js';

const schema = readFileSync(new URL('../db/schemas.sql', import.meta.url), 'utf-8');
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf-8');
await db.query('DROP TABLE IF EXISTS reviews, books, users CASCADE;');
await db.query(schema);
await db.query(seed);
console.log('Database reset complete.');
await db.end();
