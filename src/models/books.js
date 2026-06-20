import { db } from '../config/db.js';

export async function booklists() {
  const { rows } = await db.query('SELECT * FROM books');
  return rows;
}
