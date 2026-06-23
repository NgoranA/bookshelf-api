import { Router } from 'express';
import createError from 'http-errors';
import { createReview, getReviewsByBookId } from '../models/reviews.js';
import { parse } from '../lib/validate.js';
import { idSchema, newReviewSchema } from '../lib/schemas.js';

const router = Router({ mergeParams: true });

router.get('/', async (req, res) => {
  const bookId = parse(idSchema, req.params.bookId);
  res.json({ reviews: await getReviewsByBookId(bookId) });
})

router.post('/', async (req, res) => {
  const bookId = parse(idSchema, req.params.bookId);
  const input = parse(newReviewSchema, req.body, 422);
  try {
    const created = await createReview({ ...input, book_id: bookId });
    res.status(201).json({ id: created.id });
  } catch (error) {
    if (error.message === 'Foreign key violation: reviewer_id or book_id does not exist') throw createError(400, 'Invalid reviewer_id or book_id');
    throw error;
  }
})



export default router;
