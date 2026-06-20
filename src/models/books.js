import { db } from '../config/db.js';

export async function booklists({ after = 0, limit = 20, status, q }) {
  const conditions = ['id > $1'];
  const params = [after];

  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }

  if (q) { params.push(q); conditions.push(`(title ILIKE '%' ||  $${params.length} || '%' OR author ILIKE '%' || $${params.length} || '%')`) }

  params.push(limit);
  const { rows } = await db.query(`SELECT id, title, author, genre, status, created_at FROM books WHERE ${conditions.join(' AND ')} ORDER BY id ASC LIMIT $${params.length}`, params);
  return rows;
}

export async function getBookById(id) {
  const { rows } = await db.query('SELECT b.id, b.title, b.author, b.genre, b.status, b.created_at, count(r.id)::int as review_count, round(avg(r.rating), 2)::float8 as average_review_rating from books b left join reviews r on r.book_id = b.id where b.id = $1 group by b.id', [id]);
  if (rows.length === 0) throw new Error('Book not found');
  return rows[0];
}


export async function createBook({ title, author, genre, published_date, status, owner_id }) {
  try {
    const { rows } = await db.query('INSERT INTO books (title, author, genre, published_date, status, owner_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [title, author, genre, published_date, status, owner_id]);
    return rows[0];
  } catch (error) {
    if (error.code === '23505') throw new Error('duplicate');
    throw error;
  }
}
