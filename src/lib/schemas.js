import { z } from 'zod';

export const idSchema = z.coerce.number().int().positive();
export const statusEnum = z.enum(['want_to_read', 'reading', 'finished']);
