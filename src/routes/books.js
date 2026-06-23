// routes/books.js — the HTTP layer for /books.
//
// A route's job is small and predictable:
//   1. Validate the input (params → 400, body → 422).
//   2. Call the model, passing the logged-in user's id (req.user.id).
//   3. Send the right status code + JSON.
//   4. Translate known errors into HTTP errors.
//
// EVERY route here requires a logged-in user (requireUser runs first and sets
// req.user). Books are PRIVATE: each request only ever sees or changes the
// caller's own shelf. Express 5 forwards a thrown error from an async handler to
// the central error handler in app.js, so we can just throw.

import { Router } from 'express'
import createError from 'http-errors'
import * as books from '../models/books.js'
import { parse } from '../lib/validate.js'
import { requireUser } from '../middleware/auth.js'
import {
  idSchema,
  listQuerySchema,
  newBookSchema,
  updateBookSchema,
  importSchema
} from '../lib/schemas.js'

const router = Router()

// requireUser guards the WHOLE router: no valid token → 401 before any handler.
router.use(requireUser)

// GET /books → a page of YOUR books, plus a cursor for the next page.
router.get('/', async (req, res) => {
  const { after, limit, status, q } = parse(listQuerySchema, req.query)
  const items = await books.list({ ownerId: req.user.id, after, limit, status, q })

  res.json({
    items,
    next: items.length === limit ? items.at(-1).id : null
  })
})

// GET /books/:id → one of your books (with review stats), or 404.
router.get('/:id', async (req, res) => {
  const id = parse(idSchema, req.params.id)
  try {
    res.json(await books.read(id, req.user.id))
  } catch (err) {
    if (err.message === 'not found') throw createError(404, 'Book not found')
    throw err
  }
})

// POST /books → create a book on your shelf. 201 + Location header.
router.post('/', async (req, res) => {
  const input = parse(newBookSchema, req.body, 422)
  try {
    const created = await books.create({ ...input, ownerId: req.user.id })
    res.status(201).location(`/books/${created.id}`).json(created)
  } catch (err) {
    if (err.message === 'duplicate') {
      throw createError(409, 'You already have a book with this title and author')
    }
    throw err
  }
})

// POST /books/import → add many books in ONE atomic transaction (all or none).
router.post('/import', async (req, res) => {
  const { books: input } = parse(importSchema, req.body, 422)
  try {
    const created = await books.createMany(input, req.user.id)
    res.status(201).json({ items: created })
  } catch (err) {
    if (err.message === 'duplicate') {
      // The whole batch was rolled back — nothing was inserted.
      throw createError(409, 'One or more books already exist — nothing was imported')
    }
    throw err
  }
})

// PUT /books/:id → full replace (idempotent: same request twice = same result).
router.put('/:id', async (req, res) => {
  const id = parse(idSchema, req.params.id)
  const input = parse(newBookSchema, req.body, 422)
  try {
    res.json(await books.replace(id, input, req.user.id))
  } catch (err) {
    if (err.message === 'not found') throw createError(404, 'Book not found')
    if (err.message === 'duplicate') {
      throw createError(409, 'You already have a book with this title and author')
    }
    throw err
  }
})

// PATCH /books/:id → update only the fields that were sent.
router.patch('/:id', async (req, res) => {
  const id = parse(idSchema, req.params.id)
  const fields = parse(updateBookSchema, req.body, 422)
  try {
    res.json(await books.update(id, fields, req.user.id))
  } catch (err) {
    if (err.message === 'not found') throw createError(404, 'Book not found')
    if (err.message === 'no fields') {
      throw createError(422, 'Provide at least one field to update')
    }
    if (err.message === 'duplicate') {
      throw createError(409, 'You already have a book with this title and author')
    }
    throw err
  }
})

// DELETE /books/:id → 204 No Content (and an empty body — that's the rule).
router.delete('/:id', async (req, res) => {
  const id = parse(idSchema, req.params.id)
  try {
    await books.remove(id, req.user.id)
    res.status(204).end()
  } catch (err) {
    if (err.message === 'not found') throw createError(404, 'Book not found')
    throw err
  }
})

export default router
