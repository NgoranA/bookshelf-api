import { readFileSync } from 'node:fs';
import { db } from '../src/config/db.js';

try {
  const seed = readFileSync(new URL("../db/schemas.sql", import.meta.url), 'utf-8');

  await db.query(seed);
  console.log('Database migrated successfully!');
  await db.end();
} catch (error) {
  console.error('Error migrating database:', error);

}
