import { z } from 'zod';

export const idSchema = z.coerce.number().int().positive();
export const statusEnum = z.enum(['want_to_read', 'reading', 'finished']);

export const listQuerySchema = z.object({
  afer: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: statusEnum.optional(),
  q: z.string().trim().min(1).max(100).optional()
})


// we need to use the db schema in ../../db/schema.sql create the schema for book creation. 

export const createBookSchema = z.object({
  title: z.string({ required_error: "Title is required" }).trim().min(1).max(255),
  author: z.string({ required_error: "Author is required" }).trim().min(1).max(255),
  status: statusEnum.default('want_to_read'),
  published_date: z.coerce.date().optional(),
  genre: z.string().trim().min(1).max(100).optional(),
  owner_id: z.coerce.number().int().positive()
})
