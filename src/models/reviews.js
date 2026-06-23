// models/reviews.js — the data layer for a book's reviews.
//
// Reviews are a CHILD of books (a one-to-many relationship). In the database,
// reviews.book_id REFERENCES books(id), so the database itself guarantees a
// review can never point at a book that doesn't exist.
//
// PRIVATE SHELVES: you can only see or add reviews on books YOU own. Before
// touching reviews we check that the book belongs to the caller; if not, we
// throw 'not found' (the route returns 404 — we don't reveal someone else's book
// even exists).

import { db } from '../db.js'

// Throws 'not found' unless `bookId` exists AND belongs to `ownerId`.
async function assertOwnsBook (bookId, ownerId) {
  const { rowCount } = await db.query(
    'SELECT 1 FROM books WHERE id = $1 AND owner_id = $2',
    [bookId, ownerId]
  )
  if (rowCount === 0) throw new Error('not found')
}

export async function listForBook (bookId, ownerId) {
  await assertOwnsBook(bookId, ownerId)
  const { rows } = await db.query(
    `SELECT id, book_id, reviewer, rating, body, created_at
     FROM reviews
     WHERE book_id = $1
     ORDER BY id`,
    [bookId]
  )
  return rows
}

export async function addForBook (bookId, ownerId, { reviewer, rating, body }) {
  await assertOwnsBook(bookId, ownerId)
  const { rows } = await db.query(
    `INSERT INTO reviews (book_id, reviewer, rating, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, book_id, reviewer, rating, body, created_at`,
    [bookId, reviewer, rating, body]
  )
  return rows[0]
}
