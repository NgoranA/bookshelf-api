// models/books.js — THE DATA LAYER for books.
//
// This is "the model boundary": routes never write SQL directly, they call
// these functions. Each function is async, returns plain data, and throws a
// descriptive Error when something is wrong. Routes translate those errors
// into HTTP status codes.
//
// PRIVATE SHELVES: every function takes the logged-in user's id (ownerId) and
// scopes its SQL to "... AND owner_id = $n". That single filter is what makes a
// shelf private — a book that isn't yours simply isn't found (we return 404
// rather than reveal that it exists at all).

import { db } from '../db.js'

// The columns we return for a book, listed once so every query agrees.
// (owner_id is intentionally NOT returned — it's always "you".)
const BOOK_COLUMNS = 'id, title, author, genre, status, rating, created_at'

// List the OWNER'S books with optional filters and keyset pagination.
//
// Keyset pagination: instead of OFFSET (which makes the database walk and throw
// away every skipped row), we remember the last id we saw and ask for "id > that".
// It stays fast no matter how deep the page is.
export async function list ({ ownerId, after = 0, limit = 20, status, q }) {
  // We build the WHERE clause dynamically, but EVERY value still goes through a
  // $1/$2 placeholder. We are never gluing user input into the SQL string.
  const conditions = ['owner_id = $1', 'id > $2']
  const params = [ownerId, after]

  if (status) {
    params.push(status)
    conditions.push(`status = $${params.length}`)
  }

  if (q) {
    params.push(q)
    // ILIKE = case-insensitive LIKE. '%' || $n || '%' wraps the term in wildcards
    // safely on the database side.
    conditions.push(
      `(title ILIKE '%' || $${params.length} || '%' OR author ILIKE '%' || $${params.length} || '%')`
    )
  }

  params.push(limit)

  const { rows } = await db.query(
    `SELECT ${BOOK_COLUMNS}
     FROM books
     WHERE ${conditions.join(' AND ')}
     ORDER BY id
     LIMIT $${params.length}`,
    params
  )
  return rows
}

// Read one of the owner's books, enriched with how many reviews it has and their
// average rating. LEFT JOIN keeps the book even when it has zero reviews.
export async function read (id, ownerId) {
  const { rows } = await db.query(
    `SELECT b.id, b.title, b.author, b.genre, b.status, b.rating, b.created_at,
            COUNT(r.id)::int AS review_count,
            ROUND(AVG(r.rating), 2)::float8 AS average_review_rating
     FROM books b
     LEFT JOIN reviews r ON r.book_id = b.id
     WHERE b.id = $1 AND b.owner_id = $2
     GROUP BY b.id`,
    [id, ownerId]
  )
  // The ::int and ::float8 casts matter: by default the 'pg' driver returns
  // COUNT/AVG as strings (they can exceed JavaScript's safe number range).
  if (rows.length === 0) throw new Error('not found')
  return rows[0]
}

export async function create ({ title, author, genre, status, rating, ownerId }) {
  try {
    const { rows } = await db.query(
      `INSERT INTO books (owner_id, title, author, genre, status, rating)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${BOOK_COLUMNS}`,
      [ownerId, title, author, genre ?? null, status, rating ?? null]
    )
    return rows[0]
  } catch (err) {
    // 23505 = unique-constraint violation: THIS user already has a book with
    // this (title, author). The caller maps this to 409 Conflict.
    if (err.code === '23505') throw new Error('duplicate')
    throw err
  }
}

// PUT = full replace. The client sends the whole book; every column is set.
export async function replace (id, { title, author, genre, status, rating }, ownerId) {
  try {
    const { rows } = await db.query(
      `UPDATE books
       SET title = $3, author = $4, genre = $5, status = $6, rating = $7
       WHERE id = $1 AND owner_id = $2
       RETURNING ${BOOK_COLUMNS}`,
      [id, ownerId, title, author, genre ?? null, status, rating ?? null]
    )
    if (rows.length === 0) throw new Error('not found')
    return rows[0]
  } catch (err) {
    if (err.code === '23505') throw new Error('duplicate')
    throw err
  }
}

// PATCH = partial update. `fields` only contains the keys the client actually
// sent (Zod stripped anything unknown). We build the SET clause from a fixed
// ALLOWLIST of column names — never from user-supplied keys — so there is no way
// to update a column we didn't intend to.
export async function update (id, fields, ownerId) {
  const allowed = ['title', 'author', 'genre', 'status', 'rating']

  // $1 = id, $2 = ownerId; updatable values start at $3.
  const sets = []
  const params = [id, ownerId]

  for (const key of allowed) {
    if (key in fields) {
      params.push(fields[key])
      sets.push(`${key} = $${params.length}`)
    }
  }

  if (sets.length === 0) throw new Error('no fields')

  try {
    const { rows } = await db.query(
      `UPDATE books
       SET ${sets.join(', ')}
       WHERE id = $1 AND owner_id = $2
       RETURNING ${BOOK_COLUMNS}`,
      params
    )
    if (rows.length === 0) throw new Error('not found')
    return rows[0]
  } catch (err) {
    if (err.code === '23505') throw new Error('duplicate')
    throw err
  }
}

export async function remove (id, ownerId) {
  // rowCount tells us how many rows the statement touched. 0 means the book
  // didn't exist OR isn't yours — either way, 404. No separate SELECT needed.
  const { rowCount } = await db.query(
    'DELETE FROM books WHERE id = $1 AND owner_id = $2',
    [id, ownerId]
  )
  if (rowCount === 0) throw new Error('not found')
}

// Add MANY books in ONE TRANSACTION — all of them, or none of them.
//
// This is the most important pattern in the chapter. Read it slowly:
//   - db.connect() checks ONE connection out of the pool. A transaction's
//     statements must all run on the same connection.
//   - BEGIN ... COMMIT wraps the inserts so they succeed together.
//   - If ANY insert fails (e.g. a duplicate book → 23505), we ROLLBACK, and it
//     is as if none of them ever happened — no half-imported list.
//   - finally { client.release() } ALWAYS returns the connection to the pool.
//     Forgetting this is the classic "pool leak" that hangs a service.
export async function createMany (booksInput, ownerId) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const created = []
    for (const book of booksInput) {
      const { rows } = await client.query(
        `INSERT INTO books (owner_id, title, author, genre, status, rating)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${BOOK_COLUMNS}`,
        [ownerId, book.title, book.author, book.genre ?? null, book.status, book.rating ?? null]
      )
      created.push(rows[0])
    }

    await client.query('COMMIT')
    return created
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') throw new Error('duplicate')
    throw err
  } finally {
    client.release()
  }
}
