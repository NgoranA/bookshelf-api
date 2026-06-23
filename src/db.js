// db.js — owns the one and only connection to PostgreSQL.
//
// We use a connection POOL (not a single Client). A web service handles many
// requests at once; a pool keeps a small set of reusable connections and lends
// one out per query. db.query(...) borrows and returns a connection for us.

import pg from 'pg'
import { config } from './config.js'

const { Pool } = pg

export const db = new Pool({
  connectionString: config.DATABASE_URL
})

// Tip: every query that includes an external value MUST use $1, $2 placeholders
// with a separate values array, e.g.
//   db.query('SELECT * FROM books WHERE id = $1', [id])
// The driver sends the SQL and the values separately, so a value can never be
// interpreted as SQL. This is how we are immune to SQL injection.
