import { db } from '../config/db.js';

export async function booklists() {
  const { rows } = await db.query('SELECT * FROM books');
  return rows;
}

export async function getBookById(id) {
  const { rows } = await db.query('SELECT b.id, b.title, b.author, b.genre, b.status, b.created_at, count(r.id)::int as review_count, round(avg(r.rating), 2)::float8 as average_review_rating from books b left join reviews r on r.book_id = b.id where b.id = $1 group by b.id', [id]);
  if (rows.length === 0) throw new Error('Book not found');
  return rows[0];
}
