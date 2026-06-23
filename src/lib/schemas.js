// schemas.js — the "shape" of every input we accept, described once with Zod.
//
// A schema is a bouncer at the door: it checks the request (validation) and
// drops anything not on the guest list (unknown keys are stripped). The model
// and database only ever see vetted data. We also give friendly error messages
// so a 422 response actually tells the client what to fix.

import { z } from 'zod'

// A book id in the URL, e.g. /books/42. z.coerce turns the string "42" into 42
// and rejects "abc" (which becomes a 400 Bad Request, not a database error).
export const idSchema = z.coerce.number().int().positive()

// Body for POST /auth/register and POST /auth/login.
export const credentialsSchema = z.object({
  email: z
    .string({ required_error: 'email is required' })
    .email('a valid email is required')
    .max(200),
  password: z
    .string({ required_error: 'password is required' })
    .min(8, 'password must be at least 8 characters')
    .max(200, 'password is too long (max 200 characters)')
})

// The three reading states. Copied straight from the DB CHECK constraint so the
// API and the database always agree.
export const statusEnum = z.enum(['want_to_read', 'reading', 'finished'])

// Body for POST /books and PUT /books/:id (a full book).
// By default z.object STRIPS unknown keys, so a client cannot smuggle extra
// fields (like "id" or "created_at") into the row — that's mass-assignment defence.
export const newBookSchema = z.object({
  title: z
    .string({ required_error: 'title is required' })
    .min(1, 'title cannot be empty')
    .max(200, 'title is too long (max 200 characters)'),
  author: z
    .string({ required_error: 'author is required' })
    .min(1, 'author cannot be empty')
    .max(120, 'author is too long (max 120 characters)'),
  genre: z.string().min(1).max(60).optional(),
  status: statusEnum.default('want_to_read'),
  // The owner's OWN score for the book (distinct from a review's rating).
  my_rating: z
    .number()
    .int('my_rating must be a whole number')
    .min(1, 'my_rating must be between 1 and 5')
    .max(5, 'my_rating must be between 1 and 5')
    .nullable()
    .optional()
})

// Body for PATCH /books/:id. .partial() makes every field optional, so a client
// can send just the fields they want to change (e.g. { "status": "finished" }).
export const updateBookSchema = z
  .object({
    title: z.string().min(1).max(200),
    author: z.string().min(1).max(120),
    genre: z.string().min(1).max(60).nullable(),
    status: statusEnum,
    my_rating: z.number().int().min(1).max(5).nullable()
  })
  .partial()

// Body for POST /books/import — add many books in ONE atomic transaction.
export const importSchema = z.object({
  books: z
    .array(newBookSchema)
    .min(1, 'provide at least one book to import')
    .max(100, 'you can import at most 100 books at a time')
})

// Query string for GET /books?status=...&q=...&after=...&limit=...
// Note: if a query key appears twice (?status=a&status=b) it arrives as an
// ARRAY, which fails this schema → a clean 400 instead of a crash. That is our
// defence against "parameter pollution".
export const listQuerySchema = z.object({
  after: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: statusEnum.optional(),
  q: z.string().trim().min(1).max(100).optional()
})

// Body for POST /books/:id/reviews
export const newReviewSchema = z.object({
  reviewer: z.string({ required_error: 'reviewer is required' }).min(1).max(80),
  rating: z
    .number({ required_error: 'rating is required' })
    .int()
    .min(1, 'rating must be between 1 and 5')
    .max(5, 'rating must be between 1 and 5'),
  body: z.string({ required_error: 'body is required' }).min(1).max(2000)
})
