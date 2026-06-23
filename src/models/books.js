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

export async function replaceBook(id, { title, author, genre, published_date, status }) {
  try {
    const { rows } = await db.query('UPDATE books SET title = $1, author = $2, genre = $3, published_date = $4, status = $5 WHERE id = $6 RETURNING id', [title, author, genre, published_date, status, id]);
    if (rows.length === 0) throw new Error('Book not found');
    return rows[0];
  } catch (error) {
    if (error.code === '23505') throw new Error('duplicate');
    throw error;
  }
}


export async function updateBook(id, fields) {
  const allowedFields = ['title', 'author', 'genre', 'published_date', 'status'];
  const sets = []
  const params = [id]
  for (key in allowedFields) {
    if (key in fields) { params.push(fields[key]); sets.push(`${key} = $${params.length}`) }
  }
  if (sets.length === 0) throw new Error('No fields to update');
  try {
    const { rows } = await db.query(`UPDATE books SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
    if (rows.length === 0) throw new Error('Book not found');
    return rows[0];
  } catch (error) {
    if (error.code === '23505') throw new Error('duplicate');
    throw error;
  }
}

export async function deleteBook(id) {
  const { rowCount } = await db.query('DELETE FROM books WHERE id = $1', [id]);
  if (rowCount === 0) throw new Error('Book not found');
}


export async function importBooks(books) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const createdBooks = [];
    for (const book of books) {
      const { rows } = await client.query('INSERT INTO books (title, author, genre, published_date, status, owner_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [book.title, book.author, book.genre, book.published_date, book.status, book.owner_id]);
      createdBooks.push(rows[0]);
    }
    await client.query('COMMIT');
    return createdBooks;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new Error('duplicate');
    throw error
  } finally {
    client.release();
  }
}











