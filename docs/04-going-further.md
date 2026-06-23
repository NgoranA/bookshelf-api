# 05 — Going Further (after the session)

The live build is already a substantial service — CRUD, validation (`400`/`422`), a
relationship, an **atomic transaction**, hardening (helmet/CORS/rate-limit), structured
logging, and **real accounts** (register/login, hashed passwords, JWT, private shelves). This
file is what comes *after* that: the next increments that turn "a good workshop project" into
"the way real services grow."

Each item maps to a concept from the *Building Services with Node.js* notes, builds on the
**same codebase**, and is sized to be a piece of homework or a follow-up session. Roughly
ordered easiest → hardest.

> 🧭 None of these repeat what we already built. If you're looking for PUT, 422, parameter
> pollution, helmet/CORS/rate-limit, logging, the bulk-import transaction, or **user accounts +
> JWT + private shelves** — those are in [`03-build-steps.md`](03-build-steps.md). Here we go
> past them.

---

## 1. Cross-field & semantic validation (Easy)

We validate each field on its own. Real rules often span fields. Use Zod's `.refine()` /
`.superRefine()` to express them, and keep returning a `422` with a helpful message:

```js
export const newBookSchema = z.object({ /* ...fields... */ })
  .refine(b => b.status !== 'finished' || b.my_rating != null, {
    message: 'a finished book must have a rating',
    path: ['my_rating']
  })
```

Try a few: "a `want_to_read` book can't have a rating", "`genre` is required for non-fiction".
Talk through *where* a rule belongs — some live in the schema, some are true invariants that
also belong in the database as a `CHECK`.

---

## 2. Conditional updates & the lost-update race (Medium)

Our import transaction shows **atomicity**. The next transaction lesson is **concurrency**:
what happens when two clients update the same book at once? The naïve read-modify-write loses
one of them. Two classic fixes:

- **Optimistic locking** — add a `version` (or `updated_at`) column; the update says
  `... WHERE id = $1 AND version = $2` and bumps the version. `rowCount === 0` → someone
  else changed it first → return `409 Conflict`, let the client refetch and retry.
- **Pessimistic locking** — inside a transaction, `SELECT ... FOR UPDATE` locks the row so the
  second writer waits.

```js
const { rowCount } = await client.query(
  `UPDATE books SET status = $3, version = version + 1
   WHERE id = $1 AND version = $2`, [id, expectedVersion, status])
if (rowCount === 0) throw new Error('conflict')   // → 409: "the book changed, please refetch"
```

Demo the race with two overlapping `curl`s and show the second getting a `409`.

---

## 3. Roles & permissions — RBAC (Hard)

We have **authentication** (who you are) and **ownership** (your own private shelf). The next
layer is **role-based authorization** — different users can do different things:

- Add a `role` column to `users` (`'member'` default, `'admin'`). Put it in the JWT so a
  `requireRole('admin')` middleware can check it without a DB hit.
- An `admin` can list/read *any* user's books (a moderation view); a `member` stays scoped to
  their own. This is exactly where **`403` Forbidden** finally earns its place: "I know who you
  are, and you're not allowed" — distinct from the `404` we return for private books.
- Stretch: **shared shelves** — a join table (`book_collaborators`) so a book can be visible to
  more than its owner. Now "can this user see this book?" is a real authorization question, not
  just `owner_id = me`.

Talk through the difference: ownership is "is it mine?"; RBAC is "what is my *role* allowed to
do?". Most real apps need both.

---

## 4. Consume another service — the BFF pattern (Hard)

From the *Consuming and Aggregating Services* notes. Enrich a book with data from an external
API (e.g. a cover/description by ISBN from the Open Library API) using the built-in `fetch`:

- `AbortSignal.timeout(2000)` so a slow upstream can't hang your request.
- Honest status mapping: forward a `404`, emit **`502`** for a malformed upstream response,
  **`503`** for a connection failure — never let an upstream error masquerade as your `500`.
- Cache the enrichment (see #8) so you don't hammer the upstream on every read.

This is the **Backend-for-Frontend** idea: your API composes others so the client makes one call.

---

## 5. Validate requests *against the OpenAPI spec* (Medium)

We hand-write Zod schemas *and* an `openapi.yaml`. They can drift. Close the loop with a tool
like [`express-openapi-validator`](https://github.com/cdimascio/express-openapi-validator) that
validates every request/response against the spec at runtime — the contract becomes
executable, not just documentation. Discuss the trade-off vs. Zod (one source of truth vs. two).

---

## 6. Real migrations (Hard)

In Session C we changed the schema (added `users` + `owner_id`) by just re-running `db:reset` —
fine in dev, **impossible in production** (it drops all data). Production needs **versioned,
forward-only** migrations you apply without losing anything. That Session-C change is the
perfect first migration to write for real: an `ALTER TABLE books ADD COLUMN owner_id ...` plus
the new `users` table, recorded so it runs exactly once. Explore
[`node-pg-migrate`](https://github.com/salsita/node-pg-migrate) or
[`Postgrator`](https://github.com/rickbergfalk/postgrator), or hand-roll a `migrations/` folder
of numbered SQL files plus a `schema_migrations` table that records what's been applied. Our
deploy already runs `scripts/migrate.js` — swap its body for the real tool.

---

## 7. Continuous Integration (Medium)

Run the 37 tests automatically on every push. A minimal GitHub Actions workflow,
`.github/workflows/test.yml`:

```yaml
name: tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: bookshelf_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 5s
          --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: cd bookshelf-api && npm ci
      - run: cd bookshelf-api && npm test
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/bookshelf_test
          NODE_ENV: test
          JWT_SECRET: test-jwt-secret
          LOG_LEVEL: silent
```

(In CI you pass env vars directly, so the `--env-file` in `npm test` is redundant — provide a
matching `.env.test` or set them in the workflow as above.)

---

## 8. Caching & conditional requests (Medium–Hard)

Make reads cheaper and faster:

- **HTTP caching:** add an `ETag`/`Last-Modified` to `GET /books/:id`; honour
  `If-None-Match` and return **`304 Not Modified`** when nothing changed.
- **Server-side cache:** memoize hot reads (or the BFF enrichment from #4) in-process, then
  graduate to **Redis** for a cache shared across instances. Discuss invalidation — "the second
  hard problem in computer science" — on writes.

---

## 9. Mock the failure paths (Medium)

You can't make PostgreSQL fail on demand, but `node:test` can mock `db.query` to *manufacture*
a failure and prove your error hygiene: a database outage must surface as a `500` with the
**generic** message, never the raw driver error.

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '../src/db.js'
// t.mock.method(db, 'query', async () => { throw new Error('connection terminated') })
// ...then assert GET /books/1 returns 500 and body.error.message === 'Internal Server Error'
```

Same technique proves a `ROLLBACK` actually runs when an insert mid-transaction throws.

---

Each of these is a small, self-contained increment on the same codebase — exactly how real
services grow. Pick one, read the matching chapter in the notes, and build it.
