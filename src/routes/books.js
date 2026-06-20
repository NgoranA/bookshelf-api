import { Router } from 'express';
import { booklists, getBookById } from '../models/books.js';

import { parse } from '../lib/validate.js';
import { idSchema } from '../lib/schemas.js';

const router = Router();

router.get('/', async (req, res) => {
  const books = await booklists();
  res.json({ books });
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

export default router;
