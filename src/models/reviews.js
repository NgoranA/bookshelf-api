import { db } from '../config/db.js';


export async function getReviewsByBookId(book_id) {
  const { rows } = await db.query('SELECT id, reviewer_id, book_id, rating, comment, created_at FROM reviews WHERE book_id = $1 ORDER BY id DESC', [book_id]);
  return rows
}

export async function createReview({ reviewer_id, book_id, rating, comment }) {
  try {
    const { rows } = await db.query(`INSERT INTO reviews (reviewer_id, book_id, rating, comment)
                                                        VALUES ($1, $2, $3, $4) RETURNING id`,
      [reviewer_id, book_id, rating, comment])
    return rows[0]
  } catch (error) {
    if (error.code === '23503') throw new Error('Foreign key violation: reviewer_id or book_id does not exist');
    throw error;
  }
}

