# Bookshelf API

A RESTful JSON API where each reader keeps a **private shelf** of books, with reviews.
Built with **Node.js + Express 5 + PostgreSQL** as the reference project for the
*Building Services with Node.js* live session.

This is the **finished reference**. The teaching materials (how the session is run,
step by step) live in the repo's top-level [`docs/`](../docs) folder.

**Authentication is required for everything under `/books`.** Register and log in via `/auth`
to get a token (a JWT), then send it as `Authorization: Bearer <token>`. You only ever see and
change your own books.

---

## Requirements

- Node.js ≥ 20 (verified on Node 24)
- A local PostgreSQL server (no Docker needed)

## Setup

```bash
npm install
```

Create the two databases (dev + test). Pick whichever matches your machine:

```bash
# If you can run createdb directly:
createdb bookshelf
createdb bookshelf_test

# If your local Postgres uses the postgres/postgres login over TCP:
PGPASSWORD=postgres psql -h localhost -U postgres -c 'CREATE DATABASE bookshelf;'
PGPASSWORD=postgres psql -h localhost -U postgres -c 'CREATE DATABASE bookshelf_test;'
```

Configure your environment and load the schema + sample data:

```bash
cp .env.example .env       # then edit DATABASE_URL / JWT_SECRET to match your setup
npm run db:reset           # drop + create tables + seed a demo account, books & reviews
```

## Run

```bash
npm run dev                # auto-restarts on file changes (node --watch)
# or
npm start
```

- API:    http://localhost:3000
- Docs:   http://localhost:3000/docs  (interactive Swagger UI — **Authorize** with a login token)
- Health: http://localhost:3000/health

A demo account is seeded for you: **`demo@bookshelf.test` / `password123`** (it owns the
sample shelf). Log in to get a token:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"demo@bookshelf.test","password":"password123"}' | jq -r .token)

curl -H "authorization: Bearer $TOKEN" http://localhost:3000/books | jq
```

## Test

```bash
npm test                   # resets the TEST database, then runs node:test (37 tests)
```

## npm scripts

| Script               | What it does                                                       |
| -------------------- | ----------------------------------------------------------------- |
| `npm start`          | Start the server (loads `.env`)                                   |
| `npm run dev`        | Start with auto-reload (`node --watch`)                           |
| `npm run db:reset`   | **Drop**, recreate, and seed the dev database (deterministic)     |
| `npm run db:migrate` | Create tables if missing — safe for production (no data loss)     |
| `npm run db:seed`    | Insert the sample rows once                                       |
| `npm test`           | Reset the **test** database, then run the contract tests          |

## Environment variables

| Variable         | Required | Default | Purpose                                              |
| ---------------- | -------- | ------- | ---------------------------------------------------- |
| `DATABASE_URL`   | ✅       | —       | PostgreSQL connection string                         |
| `JWT_SECRET`     | ✅       | —       | Secret used to sign & verify login tokens (JWTs)     |
| `PORT`           |          | 3000    | Port to listen on                                    |
| `NODE_ENV`       |          | development | `development` \| `test` \| `production`           |
| `LOG_LEVEL`      |          | info    | pino level (`info`, `debug`, `silent`, …)            |
| `CORS_ORIGIN`    |          | `*`     | Allowed browser origin                               |
| `RATE_LIMIT_MAX` |          | 100     | Max requests per IP per minute                       |

## Project layout

```
bookshelf-api/
├── src/
│   ├── server.js        Entry point: start/stop the HTTP server
│   ├── app.js           Build the Express app (security, logging, routes, errors)
│   ├── config.js        Read + validate environment variables (once)
│   ├── db.js            The PostgreSQL connection pool
│   ├── lib/
│   │   ├── logger.js    pino logger
│   │   ├── passwords.js Hash & verify passwords (scrypt, built-in)
│   │   ├── tokens.js    Sign & verify login tokens (JWT)
│   │   ├── schemas.js   Zod schemas (the shape of every input)
│   │   └── validate.js  parse() helper: validate → 400 (params) / 422 (body)
│   ├── middleware/
│   │   └── auth.js      requireUser — verifies the token, sets req.user
│   ├── models/          The data layer (the "model boundary" — all SQL lives here)
│   │   ├── users.js     Accounts (create, find by email)
│   │   ├── books.js     Owner-scoped CRUD, incl. createMany() — the transaction
│   │   └── reviews.js   Owner-scoped (only on books you own)
│   └── routes/          The HTTP layer (validate → call model → respond)
│       ├── auth.js      POST /auth/register, POST /auth/login
│       ├── books.js
│       ├── reviews.js
│       └── docs.js      Serves /docs and /openapi.yaml
├── db/
│   ├── schema.sql       users, books (owner_id), reviews
│   └── seed.sql         A demo account + sample data
├── scripts/             migrate / seed / reset
├── test/                node:test contract tests
├── openapi.yaml         The API contract (single source of truth for the docs)
└── render.yaml          Cloud deploy blueprint (Render, no Docker — see docs/06-deployment.md)
```

## The endpoints at a glance

| Method | Path                   | Auth | Purpose                                   |
| ------ | ---------------------- | ---- | ----------------------------------------- |
| GET    | `/health`              | —    | Liveness check                            |
| POST   | `/auth/register`       | —    | Create an account                         |
| POST   | `/auth/login`          | —    | Log in → returns a token                  |
| GET    | `/books`               | 🔒   | List your books (filter, search, paginate)|
| GET    | `/books/:id`           | 🔒   | Get one of your books (+ review stats)     |
| GET    | `/books/:id/reviews`   | 🔒   | List a book's reviews                     |
| POST   | `/books`               | 🔒   | Add a book                                |
| POST   | `/books/import`        | 🔒   | Bulk import (atomic transaction)          |
| PUT    | `/books/:id`           | 🔒   | Replace a book (full)                     |
| PATCH  | `/books/:id`           | 🔒   | Update some fields                        |
| DELETE | `/books/:id`           | 🔒   | Remove a book                             |
| POST   | `/books/:id/reviews`   | 🔒   | Add a review                              |

🔒 = requires `Authorization: Bearer <token>` (from `/auth/login`). A book that isn't yours
returns **404** — private shelves don't reveal that it exists.

See [`../docs/02-api-design.md`](../docs/02-api-design.md) for the full contract and
[`../docs/04-cheatsheet.md`](../docs/04-cheatsheet.md) for copy-paste `curl` commands.
