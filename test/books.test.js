// test/books.test.js — contract tests for the Bookshelf API.
//
// We test the service the way a real client uses it: start the app on a random
// free port, send real HTTP requests with fetch, and assert on the status codes
// and JSON it returns. No browser, no extra libraries — just Node's built-in
// test runner (node:test) and assert.
//
// The API now has REAL USERS and PRIVATE SHELVES, so the tests:
//   1. log in as the seeded demo user (who owns the sample books), and
//   2. register a second user (Alice) to prove one user can't see another's shelf.
//
// `npm test` first runs scripts/reset-db.js (the "pretest" script) against the
// TEST database, so every run starts from the same known data.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createApp } from '../src/app.js'
import { db } from '../src/db.js'

const json = { 'content-type': 'application/json' }

// Build the headers for an authenticated JSON request.
function bearer(token) {
  return { 'content-type': 'application/json', authorization: `Bearer ${token}` }
}

function register(base, email, password) {
  return fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ email, password })
  })
}

async function login(base, email, password) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ email, password })
  })
  return (await res.json()).token
}

test('Bookshelf API contract', async (t) => {
  const app = createApp()
  const server = app.listen(0) // 0 = let the OS pick a free port
  await once(server, 'listening')
  const base = `http://localhost:${server.address().port}`

  // Always clean up, even if a test fails. Without db.end() the open pool keeps
  // the process alive and the test run hangs.
  t.after(async () => {
    server.close()
    await db.end()
  })

  // The seeded demo user owns the sample shelf. Alice is a fresh, empty account
  // we use to prove shelves are private.
  const demoToken = await login(base, 'demo@bookshelf.test', 'password123')
  await register(base, 'alice@test.dev', 'password123')
  const aliceToken = await login(base, 'alice@test.dev', 'password123')

  // -------------------------------------------------------------------------
  // Accounts: register & login
  // -------------------------------------------------------------------------

  await t.test('POST /auth/register → 201 with the new user', async () => {
    const res = await register(base, 'bob@test.dev', 'password123')
    assert.equal(res.status, 201)
    const user = await res.json()
    assert.equal(user.email, 'bob@test.dev')
    assert.ok(user.id)
    assert.equal(user.password, undefined) // never leak the password/hash
    assert.equal(user.password_hash, undefined)
  })

  await t.test('POST /auth/register → 409 on a duplicate email', async () => {
    const res = await register(base, 'alice@test.dev', 'password123')
    assert.equal(res.status, 409)
  })

  await t.test('POST /auth/register → 422 on a bad email / short password', async () => {
    const res = await register(base, 'not-an-email', 'short')
    assert.equal(res.status, 422)
    const body = await res.json()
    assert.ok(Array.isArray(body.error.detail))
  })

  await t.test('POST /auth/login → 200 + a token', async () => {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email: 'demo@bookshelf.test', password: 'password123' })
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(typeof body.token, 'string')
    assert.equal(body.user.email, 'demo@bookshelf.test')
  })

  await t.test('POST /auth/login → 401 on a wrong password', async () => {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email: 'demo@bookshelf.test', password: 'wrongpassword' })
    })
    assert.equal(res.status, 401)
  })

  await t.test('POST /auth/login → 401 on an unknown email', async () => {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email: 'nobody@test.dev', password: 'password123' })
    })
    assert.equal(res.status, 401)
  })

  // -------------------------------------------------------------------------
  // Authentication is required for everything under /books
  // -------------------------------------------------------------------------

  await t.test('GET /health → 200 (public, no token)', async () => {
    const res = await fetch(`${base}/health`)
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { status: 'ok' })
  })

  await t.test('GET /books without a token → 401', async () => {
    const res = await fetch(`${base}/books`)
    assert.equal(res.status, 401)
  })

  await t.test('GET /books with an invalid token → 401', async () => {
    const res = await fetch(`${base}/books`, { headers: { authorization: 'Bearer not.a.real.token' } })
    assert.equal(res.status, 401)
  })

  // -------------------------------------------------------------------------
  // Reads (as the demo user, who owns the seeded shelf)
  // -------------------------------------------------------------------------

  await t.test('GET /books → returns a page + a cursor', async () => {
    const res = await fetch(`${base}/books?limit=3`, { headers: bearer(demoToken) })
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /application\/json/)
    const body = await res.json()
    assert.equal(body.items.length, 3)
    assert.equal(typeof body.next, 'number')
  })

  await t.test('GET /books?status=finished → only finished books', async () => {
    const res = await fetch(`${base}/books?status=finished`, { headers: bearer(demoToken) })
    const body = await res.json()
    assert.equal(body.items.length, 3)
    assert.ok(body.items.every((b) => b.status === 'finished'))
  })

  await t.test('GET /books?q=habits → searches title/author', async () => {
    const res = await fetch(`${base}/books?q=habits`, { headers: bearer(demoToken) })
    const body = await res.json()
    assert.equal(body.items.length, 1)
    assert.equal(body.items[0].title, 'Atomic Habits')
  })

  await t.test('GET /books?status=bogus → 400 (invalid enum)', async () => {
    const res = await fetch(`${base}/books?status=bogus`, { headers: bearer(demoToken) })
    assert.equal(res.status, 400)
  })

  await t.test('GET /books?status=a&status=b → 400 (parameter pollution handled)', async () => {
    // A duplicated query key arrives as an array, which the schema rejects
    // cleanly instead of crashing the process.
    const res = await fetch(`${base}/books?status=reading&status=finished`, { headers: bearer(demoToken) })
    assert.equal(res.status, 400)
  })

  await t.test('GET /books/1 → a book with review stats', async () => {
    const res = await fetch(`${base}/books/1`, { headers: bearer(demoToken) })
    assert.equal(res.status, 200)
    const book = await res.json()
    assert.equal(book.title, 'The Pragmatic Programmer')
    assert.equal(book.review_count, 2)
    assert.equal(book.average_review_rating, 4.5)
  })

  await t.test('GET /books/999999 → 404', async () => {
    const res = await fetch(`${base}/books/999999`, { headers: bearer(demoToken) })
    assert.equal(res.status, 404)
  })

  await t.test('GET /books/abc → 400 (non-numeric id)', async () => {
    const res = await fetch(`${base}/books/abc`, { headers: bearer(demoToken) })
    assert.equal(res.status, 400)
  })

  // -------------------------------------------------------------------------
  // Private shelves: one user cannot see or touch another's books
  // -------------------------------------------------------------------------

  await t.test('GET /books as a fresh user → an empty shelf', async () => {
    const res = await fetch(`${base}/books`, { headers: bearer(aliceToken) })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.items.length, 0)
    assert.equal(body.next, null)
  })

  await t.test("GET /books/1 as Alice → 404 (it's the demo user's book)", async () => {
    const res = await fetch(`${base}/books/1`, { headers: bearer(aliceToken) })
    assert.equal(res.status, 404)
  })

  let aliceSapiensId

  await t.test('Alice can add a book the demo user already owns (per-owner uniqueness)', async () => {
    const res = await fetch(`${base}/books`, {
      method: 'POST',
      headers: bearer(aliceToken),
      body: JSON.stringify({ title: 'Sapiens', author: 'Yuval Noah Harari' })
    })
    assert.equal(res.status, 201) // demo has it, but Alice doesn't → fine
    aliceSapiensId = (await res.json()).id
  })

  await t.test("Alice's book is invisible to the demo user → 404", async () => {
    const res = await fetch(`${base}/books/${aliceSapiensId}`, { headers: bearer(demoToken) })
    assert.equal(res.status, 404)
  })

  await t.test('PATCH /books/1 as Alice → 404 (cannot modify the demo user\'s book)', async () => {
    const res = await fetch(`${base}/books/1`, {
      method: 'PATCH',
      headers: bearer(aliceToken),
      body: JSON.stringify({ status: 'finished' })
    })
    assert.equal(res.status, 404)
  })

  // -------------------------------------------------------------------------
  // Create (as Alice, on her own shelf)
  // -------------------------------------------------------------------------

  let createdId

  await t.test('POST /books → 201 + Location, defaults applied', async () => {
    const res = await fetch(`${base}/books`, {
      method: 'POST',
      headers: bearer(aliceToken),
      body: JSON.stringify({ title: 'Test-Driven Development', author: 'Kent Beck', genre: 'Software' })
    })
    assert.equal(res.status, 201)
    const book = await res.json()
    assert.equal(book.title, 'Test-Driven Development')
    assert.equal(book.status, 'want_to_read') // default from the schema
    assert.equal(res.headers.get('location'), `/books/${book.id}`)
    createdId = book.id
  })

  await t.test('POST /books → 422 on invalid body', async () => {
    const res = await fetch(`${base}/books`, {
      method: 'POST',
      headers: bearer(aliceToken),
      body: JSON.stringify({ title: '' }) // empty title, missing author
    })
    assert.equal(res.status, 422)
    const body = await res.json()
    assert.equal(body.error.status, 422)
    assert.ok(Array.isArray(body.error.detail)) // helpful field-by-field messages
  })

  await t.test('POST /books → 409 on a duplicate within your own shelf', async () => {
    const res = await fetch(`${base}/books`, {
      method: 'POST',
      headers: bearer(aliceToken),
      body: JSON.stringify({ title: 'Sapiens', author: 'Yuval Noah Harari' }) // Alice already added this
    })
    assert.equal(res.status, 409)
  })

  await t.test('POST /books → ignores unknown fields (no mass assignment)', async () => {
    const res = await fetch(`${base}/books`, {
      method: 'POST',
      headers: bearer(aliceToken),
      body: JSON.stringify({ title: 'Refactoring', author: 'Martin Fowler', id: 999999, owner_id: 1 })
    })
    assert.equal(res.status, 201)
    const book = await res.json()
    assert.notEqual(book.id, 999999) // the smuggled id was stripped & ignored
  })

  // -------------------------------------------------------------------------
  // Update (PUT = full replace, PATCH = partial) & delete
  // -------------------------------------------------------------------------

  await t.test('PUT /books/:id → full replace', async () => {
    const res = await fetch(`${base}/books/${createdId}`, {
      method: 'PUT',
      headers: bearer(aliceToken),
      body: JSON.stringify({ title: 'TDD By Example', author: 'Kent Beck' })
    })
    assert.equal(res.status, 200)
    const book = await res.json()
    assert.equal(book.title, 'TDD By Example')
    assert.equal(book.status, 'want_to_read') // replaced → back to default
    assert.equal(book.genre, null) // not sent → cleared by full replace
  })

  await t.test('PATCH /books/:id → updates only the sent fields', async () => {
    const res = await fetch(`${base}/books/${createdId}`, {
      method: 'PATCH',
      headers: bearer(aliceToken),
      body: JSON.stringify({ status: 'finished', my_rating: 5 })
    })
    assert.equal(res.status, 200)
    const book = await res.json()
    assert.equal(book.status, 'finished')
    assert.equal(book.my_rating, 5)
    assert.equal(book.author, 'Kent Beck') // untouched field stays the same
  })

  await t.test('DELETE /books/:id → 204, then 404 on repeat', async () => {
    const first = await fetch(`${base}/books/${createdId}`, { method: 'DELETE', headers: bearer(aliceToken) })
    assert.equal(first.status, 204)
    const second = await fetch(`${base}/books/${createdId}`, { method: 'DELETE', headers: bearer(aliceToken) })
    assert.equal(second.status, 404)
  })

  // -------------------------------------------------------------------------
  // Transactions: bulk import is all-or-nothing
  // -------------------------------------------------------------------------

  await t.test('POST /books/import → 201 inserts the whole batch', async () => {
    const res = await fetch(`${base}/books/import`, {
      method: 'POST',
      headers: bearer(aliceToken),
      body: JSON.stringify({
        books: [
          { title: 'Import One', author: 'Author A' },
          { title: 'Import Two', author: 'Author B' }
        ]
      })
    })
    assert.equal(res.status, 201)
    const body = await res.json()
    assert.equal(body.items.length, 2)
  })

  await t.test('POST /books/import → 409 and rolls back the ENTIRE batch on a duplicate', async () => {
    const res = await fetch(`${base}/books/import`, {
      method: 'POST',
      headers: bearer(aliceToken),
      body: JSON.stringify({
        books: [
          { title: 'Rollback One', author: 'Author C' },
          { title: 'Sapiens', author: 'Yuval Noah Harari' }, // Alice already has this → fails
          { title: 'Rollback Two', author: 'Author D' }
        ]
      })
    })
    assert.equal(res.status, 409)
    // Atomicity: because one row failed, NONE were inserted.
    const check = await (await fetch(`${base}/books?q=Rollback`, { headers: bearer(aliceToken) })).json()
    assert.equal(check.items.length, 0)
  })

  // -------------------------------------------------------------------------
  // Reviews (the one-to-many relationship), scoped to your own books
  // -------------------------------------------------------------------------

  await t.test('GET /books/1/reviews → lists the seeded reviews (as the owner)', async () => {
    const res = await fetch(`${base}/books/1/reviews`, { headers: bearer(demoToken) })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.items.length, 2)
  })

  await t.test('POST /books/1/reviews → 201 (owner adds a review)', async () => {
    const res = await fetch(`${base}/books/1/reviews`, {
      method: 'POST',
      headers: bearer(demoToken),
      body: JSON.stringify({ reviewer: 'Tomi', rating: 5, body: 'Loved it.' })
    })
    assert.equal(res.status, 201)
    const review = await res.json()
    assert.equal(review.book_id, 1)
    assert.equal(review.reviewer, 'Tomi')
  })

  await t.test('POST /books/1/reviews without a token → 401', async () => {
    const res = await fetch(`${base}/books/1/reviews`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ reviewer: 'Tomi', rating: 5, body: 'No token.' })
    })
    assert.equal(res.status, 401)
  })

  await t.test("GET /books/1/reviews as Alice → 404 (not her book)", async () => {
    const res = await fetch(`${base}/books/1/reviews`, { headers: bearer(aliceToken) })
    assert.equal(res.status, 404)
  })

  await t.test('POST /books/999999/reviews → 404 (book does not exist)', async () => {
    const res = await fetch(`${base}/books/999999/reviews`, {
      method: 'POST',
      headers: bearer(demoToken),
      body: JSON.stringify({ reviewer: 'Tomi', rating: 5, body: 'Nope.' })
    })
    assert.equal(res.status, 404)
  })
})
