# 01 — Requirements (do this *with* the students)

> ⏱️ ~15 minutes of the design block. Goal: a small, agreed list of what the service must do —
> on a whiteboard or shared doc — **before** any code.

The single most important habit we're teaching isn't Express. It's this: **understand the
problem and agree on the contract before you build.** Changing your mind on a whiteboard is
free. Changing it across 20 files is expensive.

---

## How to run the activity

### Step 1 — Pick the problem (2 min)
Frame it in one sentence the whole room agrees on:

> *"I want a service where I sign in to my own account and keep a private shelf of the books I
> want to read, am reading, and have finished — let me import a whole reading list at once,
> and jot down reviews. Only I can see and change my shelf."*

A relatable, bounded problem. (Swap the domain — a task list, a recipe box, a movie
watchlist — and the *shape* of the solution is identical.)

### Step 2 — Write user stories (5 min)
Ask: *"As a reader, I want to ______ so that ______."* Collect ~8 on the board:

- As a visitor, I want to **register** for an account, so I can have my own shelf.
- As a reader, I want to **log in**, so the service knows it's me.
- As a reader, I want to **add a book** to my shelf, so I don't forget it.
- As a reader, I want to **see all my books**, so I can browse them.
- As a reader, I want to **search/filter** my books, so I can find one quickly.
- As a reader, I want to **update a book** (mark it "finished", give it a rating).
- As a reader, I want to **remove a book**, so my shelf stays tidy.
- As a reader, I want to **import a whole list at once**, and if one entry is bad I want
  **none** of them added (so I can fix and retry cleanly).
- As a reader, I want to **leave reviews** on a book and read them later.
- As a reader, I want my shelf to be **private** — only I can see or change my books, even
  though other people use the same service.

### Step 3 — Prioritise (MoSCoW) (3 min)

| Priority    | Stories                                                                  |
| ----------- | ------------------------------------------------------------------------ |
| **Must**    | register & log in; add, list, view one, update, delete **my own** books; reject bad input |
| **Should**  | search & filter; pagination; reviews (the relationship); private shelves  |
| **Could**   | bulk import (atomic); review statistics                                   |
| **Won't** (today) | roles/admin, sharing a shelf, recommendations, password reset, cover images |

🗣️ *Talking point:* naming what we **Won't** do protects the session from scope creep. (We do
real accounts with login here; roles/RBAC and password reset are great follow-ups — see
*Going Further*.)

### Step 4 — Define the data (5 min)
Reuse their database skills. Three things to remember now: **users**, **books**, **reviews**.

**User**
| Field           | Type      | Rules                                       |
| --------------- | --------- | ------------------------------------------- |
| `id`            | integer   | assigned by the database                    |
| `email`         | text      | required, **unique** (no two accounts share one) |
| `password_hash` | text      | required — a hash, **never** the raw password |
| `created_at`    | timestamp | set automatically                           |

**Book** *(belongs to a user)*
| Field        | Type      | Rules                                                       |
| ------------ | --------- | ---------------------------------------------------------- |
| `id`         | integer   | assigned by the database, read-only                        |
| `owner_id`   | integer   | which user this book belongs to                            |
| `title`      | text      | required                                                   |
| `author`     | text      | required (`owner + title + author` together are **unique**) |
| `genre`      | text      | optional                                                   |
| `status`     | text      | one of `want_to_read` / `reading` / `finished`             |
| `my_rating`  | integer   | optional, 1–5 — **my own** score (≠ a review's rating)     |
| `created_at` | timestamp | set automatically                                          |

**Review** *(a child of a book)*
| Field       | Type    | Rules                              |
| ----------- | ------- | ---------------------------------- |
| `id`        | integer | assigned by the database          |
| `book_id`   | integer | which book this review belongs to |
| `reviewer`  | text    | required                          |
| `rating`    | integer | required, 1–5                     |
| `body`      | text    | required                          |
| `created_at`| timestamp | set automatically               |

🗣️ *Talking points:* a user **has many** books; a book **belongs to** a user; a book **has
many** reviews. Those are **one-to-many** relationships (foreign keys). Making
`(owner_id, title, author)` **unique** means *I* can't add the same book twice, but two
different readers can each keep their own copy — re-adding *my* book is a *conflict* (`409`).

---

## The agreed requirements (the "answer")

Pin this where everyone can see it for the rest of the session.

**The Bookshelf API lets a reader manage a private shelf of books after logging in.**

A **user** has an email (unique) and a password (stored only as a hash). A **book** belongs to
one user and has: id, title (required), author (required, unique together with title *for that
owner*), genre, status (`want_to_read` | `reading` | `finished`, default `want_to_read`),
`my_rating` (1–5, optional — the owner's own score), and a created timestamp.

The service must let a client:

1. **Register** an account and **log in** to receive a token.
2. **Add** a book to their own shelf.
3. **List** their books — with optional **filter by status**, **search by title/author**, and
   **pagination**.
4. **Get** a single book by id (including how many reviews it has and their average rating).
5. **Replace** (PUT) or **update** (PATCH) a book.
6. **Delete** a book.
7. **Import** many books at once — **atomically** (all succeed or none do).
8. **List** and **add reviews** for a book.

It must behave well and safely:

- Always respond with **JSON** and the right **HTTP status code**.
- **Reject bad input**: malformed requests (bad id) → `400`; invalid bodies → `422` (with
  helpful messages); duplicates → `409`.
- Require a valid login for everything except registering and logging in → `401` without it.
- **Keep shelves private**: you only ever see or change your own books; someone else's book is
  `404` to you (we don't reveal it exists).
- Return `404` when a book doesn't exist; never leak internal errors (like raw SQL).
- Be reasonably hardened: security headers, CORS, and basic rate limiting, with structured logs.

> 🧭 **Build note for the facilitator:** we don't build all of this on day one. Auth arrives in
> two stages so it stays approachable — a simple shared **API key** first (Session B), then
> **real accounts + private shelves** (Session C). The requirements above describe the
> *finished* product.

> Next: turn these into a precise API contract → [`02-api-design.md`](02-api-design.md).
