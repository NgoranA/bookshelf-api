// validate.js — a tiny helper so routes can validate input in one clean line.
//
//   const id   = parse(idSchema, req.params.id)        // bad id   → 400
//   const book = parse(newBookSchema, req.body, 422)   // bad body → 422
//
// Why two status codes?
//   - 400 Bad Request: the request is malformed at the HTTP level — a bad id in
//     the URL, a junk query string. The client got the *request* wrong.
//   - 422 Unprocessable Entity: the JSON parsed fine, but its *contents* break
//     our rules (missing title, rating of 9, etc.). The body is well-formed but
//     semantically invalid. Many APIs use 422 for body validation; we do too.
//
// Either way, in Express 5 a throw inside an async handler is automatically
// forwarded to the central error handler in app.js.

import createError from 'http-errors'
import { config } from '../config.js'

export function parse (schema, input, status = 400) {
  const result = schema.safeParse(input)

  if (!result.success) {
    // In development/test we include WHICH fields failed and WHY (great for
    // learners and frontend devs). In production we keep it generic so we don't
    // advertise our internal rules to attackers.
    const detail =
      config.NODE_ENV === 'production'
        ? undefined
        : result.error.issues.map((i) => ({
            field: i.path.join('.') || '(body)',
            message: i.message
          }))

    const message = status === 422 ? 'Validation failed' : 'Invalid request'
    throw createError(status, message, { detail })
  }

  return result.data
}
