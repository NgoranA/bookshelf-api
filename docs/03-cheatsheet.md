# 04 — Cheatsheet (keep this open while you teach)

Quick reference for the live session: copy-paste `curl` commands, status codes, project map,
and instant fixes for the errors students hit most.

---

## npm scripts (in `bookshelf-api/`)

```bash
npm install            # install dependencies
npm run dev            # start with auto-reload (node --watch)
npm start              # start once
npm run db:reset       # DROP + recreate + seed the dev DB (demo account + sample books)
npm run db:migrate     # create tables if missing (safe; no data loss)
npm run db:seed        # insert sample rows once
npm test               # reset the TEST db, then run node:test (37 tests)
```

---

## Logging in (you need a token for everything under /books)

Every `/books` request needs `Authorization: Bearer <token>`. Get a token by logging in.
A demo account is seeded for you (`demo@bookshelf.test` / `password123`) and owns the sample
shelf. Grab a token into a shell variable:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"demo@bookshelf.test","password":"password123"}' | jq -r .token)
```

Register a brand-new (empty) account instead:

```bash
curl -i -X POST http://localhost:3000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"me@example.com","password":"password123"}'        # → 201
```

---

## curl quick reference

> Pipe to `jq` for pretty JSON (`| jq`). Use `-i` to see status + headers. `$TOKEN` is from above.

```bash
# Health (public)
curl http://localhost:3000/health

# ---- Reads (your own shelf — all need the token) ----
curl -H "authorization: Bearer $TOKEN" 'http://localhost:3000/books'
curl -H "authorization: Bearer $TOKEN" 'http://localhost:3000/books?status=reading'
curl -H "authorization: Bearer $TOKEN" 'http://localhost:3000/books?q=clean'
curl -H "authorization: Bearer $TOKEN" 'http://localhost:3000/books?limit=2'
curl -H "authorization: Bearer $TOKEN" 'http://localhost:3000/books?limit=2&after=2'  # next page
curl -H "authorization: Bearer $TOKEN"  http://localhost:3000/books/1                 # one book (+ stats)
curl -H "authorization: Bearer $TOKEN"  http://localhost:3000/books/1/reviews         # a book's reviews

# ---- Writes ----
# Create → 201 + Location
curl -i -X POST http://localhost:3000/books \
  -H 'content-type: application/json' -H "authorization: Bearer $TOKEN" \
  -d '{"title":"Dune","author":"Frank Herbert","genre":"Sci-Fi","status":"reading"}'

# Bulk import (one atomic transaction) → 201, or 409 (whole batch rolled back)
curl -i -X POST http://localhost:3000/books/import \
  -H 'content-type: application/json' -H "authorization: Bearer $TOKEN" \
  -d '{"books":[{"title":"A","author":"AA"},{"title":"B","author":"BB"}]}'

# Replace (full) → 200
curl -X PUT http://localhost:3000/books/1 \
  -H 'content-type: application/json' -H "authorization: Bearer $TOKEN" \
  -d '{"title":"New Title","author":"New Author","status":"finished","my_rating":5}'

# Update (partial) → 200
curl -X PATCH http://localhost:3000/books/1 \
  -H 'content-type: application/json' -H "authorization: Bearer $TOKEN" \
  -d '{"status":"finished","my_rating":5}'

# Delete → 204 (no body)
curl -i -X DELETE http://localhost:3000/books/1 -H "authorization: Bearer $TOKEN"

# Add a review (on your own book) → 201
curl -i -X POST http://localhost:3000/books/1/reviews \
  -H 'content-type: application/json' -H "authorization: Bearer $TOKEN" \
  -d '{"reviewer":"Ada","rating":5,"body":"A must-read."}'

# Raw API spec
curl http://localhost:3000/openapi.yaml
```

**Demonstrations worth doing live:**
```bash
# No token → 401
curl -i http://localhost:3000/books

# Invalid/expired token → 401
curl -i -H 'authorization: Bearer not.a.real.token' http://localhost:3000/books

# Bad login → 401 ("Invalid email or password"); short password → 422 (validation)
curl -i -X POST http://localhost:3000/auth/login -H 'content-type: application/json' -d '{"email":"demo@bookshelf.test","password":"wrongpassword"}'

# Invalid body → 422 with field-by-field detail
curl -s -X POST http://localhost:3000/books -H 'content-type: application/json' -H "authorization: Bearer $TOKEN" -d '{"title":""}' | jq

# Duplicate on YOUR shelf → 409
curl -i -X POST http://localhost:3000/books -H 'content-type: application/json' -H "authorization: Bearer $TOKEN" -d '{"title":"Sapiens","author":"Yuval Noah Harari"}'

# Private shelves: log in as a DIFFERENT user, then ask for the demo user's book → 404
OTHER=$(curl -s -X POST http://localhost:3000/auth/register -H 'content-type: application/json' -d '{"email":"other@x.dev","password":"password123"}' >/dev/null; \
        curl -s -X POST http://localhost:3000/auth/login -H 'content-type: application/json' -d '{"email":"other@x.dev","password":"password123"}' | jq -r .token)
curl -i -H "authorization: Bearer $OTHER" http://localhost:3000/books/1     # 404 (not their book)

# Parameter pollution handled → 400 (not a crash)
curl -i -H "authorization: Bearer $TOKEN" 'http://localhost:3000/books?status=reading&status=finished'
```

---

## Status codes we use

| Code | Name                  | Meaning in this API                                  |
| ---- | --------------------- | ---------------------------------------------------- |
| 200  | OK                    | Successful GET / PUT / PATCH / login                  |
| 201  | Created               | Successful POST / register (look for `Location`)      |
| 204  | No Content            | Successful DELETE (body is empty — that's correct)    |
| 400  | Bad Request           | Malformed request: bad id in URL, bad query string   |
| 401  | Unauthorized          | Not logged in, bad/expired token, or wrong password  |
| 404  | Not Found             | No such book / route — **or it isn't yours** (private)|
| 409  | Conflict              | A book you already have, or an email already registered |
| 422  | Unprocessable Entity  | Body parsed but failed validation (missing/invalid field) |
| 429  | Too Many Requests     | Rate limit exceeded                                  |
| 500  | Internal Server Error | A bug on our side (we log it, never leak details)    |

🗣️ **400 vs 422:** `400` = the *request* is malformed (bad id, junk query). `422` = the JSON
was fine but its *contents* break our rules (empty title, bad email). **401 vs 404:** `401` =
"who are you?"; a book that isn't yours is **404**, not 403 — we don't reveal it even exists.

---

## Project map

```
src/
├── server.js     start/stop the HTTP server          (entry point)
├── app.js        build the app: security → logging → routes → error handler
├── config.js     read & validate env (once)
├── db.js         the PostgreSQL pool
├── lib/
│   ├── logger.js     the pino logger
│   ├── passwords.js  hash & verify passwords (scrypt, built-in)
│   ├── tokens.js     sign & verify login tokens (JWT)
│   ├── schemas.js    Zod schemas (input shapes)
│   └── validate.js   parse() → 400 (params) / 422 (body)
├── middleware/
│   └── auth.js       requireUser — verifies the token, sets req.user
├── models/       ALL the SQL lives here (the "model boundary")
│   ├── users.js      accounts
│   ├── books.js      owner-scoped CRUD, incl. createMany() — the transaction
│   └── reviews.js    owner-scoped (only on books you own)
└── routes/       HTTP layer: validate → call model → respond
    ├── auth.js       register + login
    ├── books.js
    ├── reviews.js
    └── docs.js
```

**The flow of one request:**
```
client → [helmet · cors · logger · json · rate-limit] → route (requireUser → validate) → model (owner-scoped SQL) → PostgreSQL
                                                                                       ↓
client ← route (status + JSON)  ←  central error handler  ←  model (data or thrown error)
```

---

## Troubleshooting (fast fixes)

| Error / symptom | Fix |
| --- | --- |
| `Cannot use import statement outside a module` | Add `"type": "module"` to `package.json` (`npm pkg set type=module`). |
| `Error: connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL isn't running. Start the service (`brew services start postgresql`, `sudo systemctl start postgresql`, or Postgres.app). |
| `role "<username>" does not exist` | Peer auth picked your OS user. Use `DATABASE_URL=postgres://postgres:postgres@localhost:5432/bookshelf`, or create a role: `sudo -u postgres createuser -s <username>`. |
| `database "bookshelf" does not exist` | Create it: `createdb bookshelf` (and `createdb bookshelf_test`). |
| `password authentication failed for user "postgres"` | Wrong password in `DATABASE_URL`. Match your Postgres setup. |
| `relation "books" does not exist` | Run the schema: `npm run db:reset` (or `npm run db:migrate`). |
| `❌ Invalid configuration ... JWT_SECRET is required` | Set `JWT_SECRET=...` in your `.env` (config validation is doing its job). |
| `401` on a `/books` request | You're not sending a valid token. Log in (`/auth/login`) and pass `-H "authorization: Bearer $TOKEN"`. |
| `401` on login | Wrong email/password. (A *too-short* password is `422` — validation runs first.) |
| `404` on a book you "know exists" | Private shelves: it belongs to another user. Log in as its owner. |
| `409` on create/import | You already have that (title, author). Imports are all-or-nothing — fix the dupe and retry. |
| `409` on register | That email is already registered — log in instead. |
| `req.body is undefined` | Missing `app.use(express.json())`, or no `content-type: application/json`. |
| `EADDRINUSE: address already in use :::3000` | Old server still running. Kill it (`lsof -ti:3000 | xargs kill`) or set a different `PORT`. |
| `npm test` hangs and never exits | You forgot `await db.end()` in `t.after` — the open pool keeps Node alive. |
| Async route error makes the request hang | You're on Express 4. This kit requires **Express 5** (`npm i express@^5`). |
| `/docs` is blank | Helmet's CSP blocks Swagger UI; we disable it with `helmet({ contentSecurityPolicy: false })`. |

---

## Mental models to repeat

- **Routes are thin. Models own SQL.** About to write `db.query` in a route? Stop — move it to the model.
- **Every external value goes through `$1/$2`.** No exceptions, no "trusted" inputs.
- **Validate at the boundary, then trust the parsed data inward.** Never re-read `req.body` after parsing.
- **Authentication vs authorization.** `requireUser` answers *who* you are (401 if unknown);
  scoping every query to `owner_id` answers *what's yours* (404 for anything that isn't).
- **Pick the honest status code.** `4xx` = client's fault; `5xx` = ours.
- **A transaction is all-or-nothing.** `BEGIN` → do work → `COMMIT`; any failure → `ROLLBACK`, and `release()` the client in `finally`.
- **Never store a raw password.** Hash it (scrypt); compare hashes in constant time.
