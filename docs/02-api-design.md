# 02 — API Design (the contract)

> ⏱️ ~15 minutes of the design block. We turn the requirements into a precise **contract**:
> the exact URLs, methods, status codes, and JSON shapes. Build the endpoint table on the
> board together — it becomes the to-do list for the build.

---

## A 90-second REST refresher

- **Resources** are nouns with URLs: `/books`, `/books/1`, `/books/1/reviews`.
- **Methods** are the verbs you apply to them:

  | Method | Means        | Idempotent? | Typical success |
  | ------ | ------------ | ----------- | --------------- |
  | GET    | read         | yes         | `200`           |
  | POST   | create       | no          | `201`           |
  | PUT    | replace whole| yes         | `200`           |
  | PATCH  | update part  | —           | `200`           |
  | DELETE | remove       | yes         | `204`           |

- **Status codes** say how it went:

  | Code | Meaning              | When we use it                                  |
  | ---- | -------------------- | ----------------------------------------------- |
  | 200  | OK                   | a successful GET / PUT / PATCH / login           |
  | 201  | Created              | a successful POST / register (+ a `Location`)     |
  | 204  | No Content           | a successful DELETE (and the body is empty!)     |
  | 400  | Bad Request          | the request is malformed (bad id, bad query)     |
  | 401  | Unauthorized         | not logged in, bad/expired token, or wrong login |
  | 404  | Not Found            | the resource doesn't exist — *or isn't yours*    |
  | 409  | Conflict             | clashes with existing data (dupe book / email)   |
  | 422  | Unprocessable Entity | the body parsed but failed validation            |
  | 429  | Too Many Requests    | rate limit exceeded                              |
  | 500  | Internal Server Error| *our* bug (we never blame the client for these)  |

🗣️ *Talking points:*
- `4xx` = "you (the client) made a mistake"; `5xx` = "we (the server) made a mistake."
- **`400` vs `422`:** `400` means the *request* is malformed at the HTTP level — a bad id in
  the path, a junk query string. `422` means the JSON was well-formed but its *contents*
  break our rules (empty title, rating of 9, a bad email). Many APIs use `422` for body
  validation; we do too.
- **`401` vs `404`:** `401` = "I don't know who you are." For a book that belongs to *someone
  else*, we return **`404`**, not `403` — on a private shelf we don't even admit the book
  exists. (If reads were public, "exists but not yours" would be a `403` instead.)
- **Idempotency:** sending `PUT`/`DELETE` twice has the same end result as once. `POST` does
  not — retrying it can create duplicates.

---

## The endpoints

| Method | Path                  | Auth | Purpose                                 | Success | Errors              |
| ------ | --------------------- | ---- | --------------------------------------- | ------- | ------------------- |
| GET    | `/health`             | —    | Is the service up?                      | 200     | —                   |
| POST   | `/auth/register`      | —    | Create an account                       | 201     | 409, 422            |
| POST   | `/auth/login`         | —    | Log in → returns a token                | 200     | 401, 422            |
| GET    | `/books`              | 🔒   | List YOUR books (filter/search/paginate)| 200     | 400, 401            |
| GET    | `/books/:id`          | 🔒   | Get one of your books (+ review stats)   | 200     | 400, 401, 404       |
| GET    | `/books/:id/reviews`  | 🔒   | List a book's reviews                   | 200     | 400, 401, 404       |
| POST   | `/books`              | 🔒   | Add a book                              | 201     | 401, 409, 422       |
| POST   | `/books/import`       | 🔒   | Bulk import (one transaction)           | 201     | 401, 409, 422       |
| PUT    | `/books/:id`          | 🔒   | Replace a book (full)                   | 200     | 401, 404, 409, 422  |
| PATCH  | `/books/:id`          | 🔒   | Update some fields                      | 200     | 401, 404, 409, 422  |
| DELETE | `/books/:id`          | 🔒   | Remove a book                           | 204     | 400, 401, 404       |
| POST   | `/books/:id/reviews`  | 🔒   | Add a review                            | 201     | 401, 404, 422       |

🔒 = requires `Authorization: Bearer <token>` (from `/auth/login`).

> Only `/health` and the two `/auth` routes are public — everything else needs a token, and
> only ever touches *your* books. `/books/:id/reviews` — the URL itself expresses the
> relationship "the reviews *of* this book." The path mirrors the data.

---

## Authentication & ownership

Each reader has their own account and their own **private shelf**. Two layers:

1. **Authentication — "who are you?"** Clients `POST /auth/register` then `POST /auth/login`.
   Login checks the password and returns a signed **JWT** (JSON Web Token). The client sends
   it on every other request:

   ```
   Authorization: Bearer <token>
   ```

   A middleware (`requireUser`) verifies the token before any handler runs and attaches
   `req.user`. No/invalid/expired token → `401`.

2. **Authorization — "what's yours?"** Every book query is scoped to `req.user.id`, so you
   only ever see or change your own books. A book that belongs to someone else simply isn't
   found for you → `404`.

Passwords are never stored raw — we keep a salted **scrypt** hash and compare in constant time.
The signing secret lives in the environment (`JWT_SECRET`), never in the code.

> 🧭 **Build note.** The live build introduces auth in *two* stages so juniors aren't
> overwhelmed: first a single shared **API key** on writes (Session B), then it's replaced
> with **real accounts + JWT + ownership** (Session C). The contract above is the *finished*
> design. A bigger system might add roles/RBAC — see *Going Further*.

---

## JSON shapes

### Credentials (register / login body)
```json
{ "email": "me@example.com", "password": "password123" }
```
`password` is at least 8 characters; both are required.

### Login response
```json
{ "token": "<a JWT>", "user": { "id": 1, "email": "me@example.com" } }
```

### A book
```json
{
  "id": 1,
  "title": "The Pragmatic Programmer",
  "author": "Andrew Hunt",
  "genre": "Software",
  "status": "finished",
  "my_rating": 5,
  "created_at": "2026-06-20T14:10:47.803Z"
}
```
(The book's `owner_id` is *you* — it's never sent back; the API already scopes everything to
the logged-in user.)

### A book with review stats (returned by `GET /books/:id`)
```json
{ "id": 1, "title": "...", "review_count": 2, "average_review_rating": 4.5 }
```

### The list response (paginated)
```json
{ "items": [ { "id": 1 }, { "id": 2 } ], "next": 2 }
```
`next` is a **cursor**: pass it back as `?after=2` for the next page. `null` means "no more".
(This is *keyset* pagination — fast at any depth, unlike `OFFSET`.)

### An error (the same shape everywhere)
```json
{
  "error": {
    "status": 422,
    "message": "Validation failed",
    "detail": [
      { "field": "title",  "message": "title cannot be empty" },
      { "field": "author", "message": "author is required" }
    ]
  }
}
```
`detail` appears only in development/test — helpful for learners and frontend devs. In
production messages stay generic so we don't advertise internals to attackers.

---

## Request bodies

**Register / Log in — `POST /auth/register`, `POST /auth/login`**
```json
{ "email": "me@example.com", "password": "password123" }
```

**Create / Replace a book — `POST /books`, `PUT /books/:id`**
```json
{ "title": "Dune", "author": "Frank Herbert", "genre": "Sci-Fi", "status": "reading" }
```
`title` and `author` are required; `status` defaults to `want_to_read`; unknown fields are
ignored (you can't sneak in an `id` or an `owner_id`).

**Update a book — `PATCH /books/:id`** (send only what changes)
```json
{ "status": "finished", "my_rating": 5 }
```

**Bulk import — `POST /books/import`** (all-or-nothing)
```json
{ "books": [ { "title": "A", "author": "AA" }, { "title": "B", "author": "BB" } ] }
```

**Add a review — `POST /books/:id/reviews`**
```json
{ "reviewer": "Ada", "rating": 5, "body": "A must-read." }
```

---

## The data model (database design)

Three tables, two relationships. (Students write this `schema.sql` in the build.)

```
users                         books                                  reviews
-----                         ------                                 -------
id          PK                id          PK                         id        PK
email       NOT NULL UNIQUE   owner_id    FK → users(id) CASCADE      book_id   FK → books(id) CASCADE
password_hash NOT NULL        title       NOT NULL  ┐                 reviewer  NOT NULL
created_at                    author      NOT NULL  ┘                 rating    NOT NULL  CHECK 1..5
                              genre                  UNIQUE            body      NOT NULL
                              status      CHECK(enum) (owner,title,author)  created_at
                              my_rating   CHECK 1..5
                              created_at
```

Design decisions worth saying out loud:

- **Ownership is a foreign key.** `books.owner_id → users(id)` makes "whose book is this?" a
  property of the data, not just the code. `ON DELETE CASCADE` means deleting a user removes
  their whole shelf (and each book's reviews) with them.
- **Uniqueness is *per owner*:** `UNIQUE (owner_id, title, author)`. Two readers can each keep
  their own "Sapiens", but one reader can't add it twice. A duplicate insert raises error
  `23505`, which our code turns into `409 Conflict`.
- **The database enforces the rules too.** `NOT NULL`, the status `CHECK`, the rating range,
  uniqueness, and the foreign keys are guarantees that hold even if the application code has a
  bug. Belt *and* braces.
- **The `status` enum lives in two places** (the DB `CHECK` and the Zod schema). Intentional:
  the API rejects bad input early with a friendly message, and the DB is the final backstop.

> 📦 **Why keyset pagination?** `OFFSET 10000` makes the database walk and discard 10,000
> rows every time — slower the deeper you go. *Keyset* pagination remembers the last id and
> asks `WHERE owner_id = $1 AND id > $2 ORDER BY id LIMIT $3`, jumping straight to the right
> place in the index. That's why our list returns a `next` cursor instead of a page number.

> Next: build it, step by step → [`03-build-steps.md`](03-build-steps.md).
