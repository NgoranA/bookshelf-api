import { Router } from 'express';
import createError from 'http-errors';
import { importBooks, booklists, createBook, getBookById, updateBook, deleteBook, replaceBook } from '../models/books.js';

import { parse } from '../lib/validate.js';
import { idSchema, listQuerySchema, createBookSchema, updateBookSchema } from '../lib/schemas.js';
import { booklistController } from '../controllers/books/booklists.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

router.get('/', booklistController)

router.get('/:id', async (req, res) => {
  const id = parse(idSchema, req.params.id);
  try {
    const book = await getBookById(id);
    res.json({ book });
  } catch (error) {
    if (err.message === 'Book not found') throw createError(404, 'Book not found');
    throw error;
  }
})

router.post('/', async (req, res) => {
  const input = parse(createBookSchema, req.body);

  try {
    const createdBook = await createBook(input);
    res.status(201).json({ id: createdBook.id });
  } catch (error) {
    if (error.message === 'duplicate') throw createError(409, 'Book with the same title and author already exists');
    throw error;
  }
})

router.put('/:id', async (req, res) => {
  const id = parse(idSchema, req.params.id);
  const input = parse(createBookSchema, req.body, 422);
  try {
    res.json(await replaceBook(id, input));
  } catch (error) {
    if (error.message === 'Book not found') throw createError(404, 'Book not found');
    if (error.message === 'duplicate') throw createError(409, 'Book with the same title and author already exists');
    throw error;
  }
})


router.patch('/:id', async (req, res) => {
  const id = parse(idSchema, req.params.id);
  const fields = parse(updateBookSchema, req.body, 422);
  try {
    res.json(await updateBook(id, fields));
  } catch (error) {
    if (error.message === 'Book not found') throw createError(404, 'Book not found');
    if (error.message === 'duplicate') throw createError(409, 'Book with the same title and author already exists');
    if (error.message === 'No fields to update') throw createError(400, 'No fields to update');
    throw error;
  }
})

router.delete('/:id', async (req, res) => {
  const id = parse(idSchema, req.params.id);
  try {
    await deleteBook(id);
    res.status(204).end();
  } catch (error) {
    if (error.message === 'Book not found') throw createError(404, 'Book not found');
    throw error;
  }
})

router.post("/import", async (req, res) => {
  const { books } = parse(importSchema, req.body, 422);
  try {
    const created = await importBooks(books);
    res.status(201).json({ created });
  } catch (error) {
    if (error.message === 'duplicate') throw createError(409, 'Book with the same title and author already exists');
    throw error;
  }
})
export default router;
