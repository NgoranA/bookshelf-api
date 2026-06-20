import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url().default('postgresql://developer:pass12345@localhost:5432/bookshelf_db'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const result = schema.safeParse(process.env);
if (!result.success) {
  console.error('Invalid Configutaon')
  for (const issue of result.error.issues) console.error(` - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const config = Object.freeze(result.data);
