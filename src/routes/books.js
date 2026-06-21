import { Router } from 'express';
import createError from 'http-errors';
import { booklists, createBook, getBookById, updateBook, deleteBook, replaceBook } from '../models/books.js';

import { parse } from '../lib/validate.js';
import { idSchema, listQuerySchema, createBookSchema, updateBookSchema } from '../lib/schemas.js';

const router = Router();

router.get('/', async (req, res) => {
  const { after, limit, status, q } = parse(listQuerySchema, req.query);
  const books = await booklists({ after, limit, status, q });
  res.json({ items: books, next: books.length === limit ? books.at(-1).id : null });
})

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

export default router;
