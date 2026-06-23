import { listQuerySchema } from '../../lib/schemas.js';
import { booklists } from '../../models/books.js';
import { parse } from '../../lib/validate.js';

export async function booklistController(req, res) {
  const { after, limit, status, q } = parse(listQuerySchema, req.query);
  const books = await booklists({ after, limit, status, q });
  res.json({ items: books, next: books.length === limit ? books.at(-1).id : null });
}
