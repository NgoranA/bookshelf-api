import { Router } from 'express';
import { booklists } from '../models/books.js';

const router = Router();

router.get('/', async (req, res) => {
  const books = await booklists();
  res.json({ items: books });
})

export default router;
