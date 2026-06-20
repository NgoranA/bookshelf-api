import { readFileSync } from 'node:fs';
import { db } from '../src/config/db.js';

const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf-8');

await db.query(seed);
console.log('Database seeded successfully!');
await db.end();
