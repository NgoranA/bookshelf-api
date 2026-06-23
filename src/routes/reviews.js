// routes/reviews.js — the HTTP layer for /books/:bookId/reviews.
//
// This router is mounted at '/books/:bookId/reviews' in app.js. We pass
// { mergeParams: true } so that req.params.bookId (from the mount path) is
// visible inside these handlers.
//
// Like books, reviews are PRIVATE: you must be logged in, and you can only see
// or add reviews on a book you own. The model checks ownership and throws
// 'not found' otherwise, which we map to 404.

import { Router } from 'express'
import createError from 'http-errors'
import * as reviews from '../models/reviews.js'
import { parse } from '../lib/validate.js'
import { requireUser } from '../middleware/auth.js'
import { idSchema, newReviewSchema } from '../lib/schemas.js'

const router = Router({ mergeParams: true })

router.use(requireUser)

// GET /books/:bookId/reviews
router.get('/', async (req, res) => {
  const bookId = parse(idSchema, req.params.bookId)
  try {
    const items = await reviews.listForBook(bookId, req.user.id)
    res.json({ items })
  } catch (err) {
    if (err.message === 'not found') throw createError(404, 'Book not found')
    throw err
  }
})

// POST /books/:bookId/reviews
router.post('/', async (req, res) => {
  const bookId = parse(idSchema, req.params.bookId)
  const input = parse(newReviewSchema, req.body, 422)
  try {
    const created = await reviews.addForBook(bookId, req.user.id, input)
    res
      .status(201)
      .location(`/books/${bookId}/reviews/${created.id}`)
      .json(created)
  } catch (err) {
    // The model throws 'not found' if the book is missing or isn't yours.
    if (err.message === 'not found') throw createError(404, 'Book not found')
    throw err
  }
})

export default router
