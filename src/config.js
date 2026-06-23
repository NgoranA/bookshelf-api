// config.js — the SINGLE place we read and validate environment variables.
//
// Why validate config at startup?
//   - If a required value (like DATABASE_URL or JWT_SECRET) is missing or wrong, we
//     want to fail LOUDLY and immediately, with a clear message, instead of a
//     confusing crash later.
//   - Everywhere else in the app we import `config` and trust it is correct.
//
// Notes mirrored here: "validate at the boundary", "single source of truth",
// and "make the config read-only" (Object.freeze).

import { z } from 'zod'

const schema = z.object({
  // z.coerce.number() turns the string "3000" (env vars are always strings)
  // into the number 3000, and rejects anything that isn't a valid number.
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // No default for these on purpose: dependency/secret settings must be provided
  // explicitly. Missing them should stop boot.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // The secret we sign and verify login tokens (JWTs) with. Keep it long and
  // random in production — anyone who knows it can forge a valid token.
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required (used to sign login tokens)'),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Behaviour settings — these CAN have sensible defaults.
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100)
})

const result = schema.safeParse(process.env)

if (!result.success) {
  console.error('\n❌ Invalid configuration. Check your .env file:\n')
  for (const issue of result.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  }
  console.error('')
  process.exit(1)
}

// Object.freeze prevents any code from accidentally mutating config at runtime.
export const config = Object.freeze(result.data)
