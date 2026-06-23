// models/users.js — the data layer for user accounts.
//
// Like every model, this owns the SQL and throws descriptive errors that the
// routes translate into HTTP responses. It stores a password HASH (built in
// lib/passwords.js), never the raw password.

import { db } from '../db.js'

export async function create ({ email, passwordHash }) {
  try {
    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, created_at`,
      [email, passwordHash]
    )
    return rows[0]
  } catch (err) {
    // 23505 = the UNIQUE(email) constraint: this email is already registered.
    if (err.code === '23505') throw new Error('duplicate')
    throw err
  }
}

// Returns the FULL row (including password_hash) so login can verify the
// password, or null if no such user. Never send password_hash back to a client.
export async function findByEmail (email) {
  const { rows } = await db.query(
    `SELECT id, email, password_hash, created_at FROM users WHERE email = $1`,
    [email]
  )
  return rows[0] ?? null
}
