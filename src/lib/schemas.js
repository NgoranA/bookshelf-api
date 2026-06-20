import { z } from 'zod';

export const idSchema = z.coerce.number().int().positive();
export const statusEnum = z.enum(['want_to_read', 'reading', 'finished']);

export const listQuerySchema = z.object({
  afer: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: statusEnum.optional(),
  q: z.string().trim().min(1).max(100).optional()
})
