// lib/tokens.js — issuing and verifying login tokens (JWTs).
//
// A JWT (JSON Web Token) is a signed string the client gets at login and then
// sends back on every request ("Authorization: Bearer <token>"). Because it is
// SIGNED with our JWT_SECRET, we can trust its contents without a database
// lookup — but we can't tamper-proof what's inside, so we put only the user's
// id and email in it, never anything secret.

import jwt from 'jsonwebtoken'
import { config } from '../config.js'

const EXPIRES_IN = '7d' // tokens are valid for a week, then the user logs in again

// `sub` (subject) is the standard JWT claim for "who this token is about".
export function signToken (user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.JWT_SECRET, {
    expiresIn: EXPIRES_IN
  })
}

// Throws if the token is missing, altered, or expired — the caller turns that
// into a 401.
export function verifyToken (token) {
  return jwt.verify(token, config.JWT_SECRET)
}
