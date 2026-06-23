// middleware/auth.js — "who is making this request?"
//
// Every protected route runs requireUser first. It reads the bearer token the
// client sent, verifies it, and attaches req.user = { id, email }. Handlers then
// use req.user.id to scope everything to the logged-in person's own shelf.
//
//     Authorization: Bearer <token>   (the token comes from POST /auth/login)
//
// No valid token → 401 Unauthorized ("I don't know who you are"). This is the
// same SHAPE as the old shared-API-key check, but now it identifies a real user
// instead of just proving knowledge of one secret.

import createError from 'http-errors'
import { verifyToken } from '../lib/tokens.js'

export function requireUser (req, res, next) {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

  if (!token) return next(createError(401, 'Authentication required'))

  try {
    const payload = verifyToken(token)
    req.user = { id: payload.sub, email: payload.email }
    next()
  } catch {
    // verifyToken throws on a tampered, malformed, or expired token.
    next(createError(401, 'Invalid or expired token'))
  }
}
