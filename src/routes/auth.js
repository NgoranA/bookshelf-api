// routes/auth.js — the HTTP layer for accounts: register and log in.
//
// These two routes are PUBLIC (no token required) — they're how you get a token
// in the first place. Everything else (books, reviews) requires the token they
// hand out.
//
//   POST /auth/register  → create an account            → 201
//   POST /auth/login     → exchange email+password for a → 200 { token }
//
// We validate the body (422), hash the password before storing it, and never
// send the password (or its hash) back to the client.

import { Router } from 'express'
import createError from 'http-errors'
import * as users from '../models/users.js'
import { parse } from '../lib/validate.js'
import { credentialsSchema } from '../lib/schemas.js'
import { hashPassword, verifyPassword } from '../lib/passwords.js'
import { signToken } from '../lib/tokens.js'

const router = Router()

// A throwaway hash computed once at startup. When someone logs in with an email
// that doesn't exist, we still run a password check against THIS — so an unknown
// email costs the same time as a real one. Without it, "no such user" returns
// fast while "wrong password" runs slow scrypt, and that timing difference leaks
// which emails are registered (user enumeration).
const DUMMY_HASH = hashPassword('not-a-real-password')

// POST /auth/register → create the account, return the public user info.
router.post('/register', async (req, res) => {
  const { email, password } = parse(credentialsSchema, req.body, 422)
  try {
    const user = await users.create({ email, passwordHash: hashPassword(password) })
    res.status(201).json({ id: user.id, email: user.email })
  } catch (err) {
    if (err.message === 'duplicate') {
      throw createError(409, 'That email is already registered')
    }
    throw err
  }
})

// POST /auth/login → verify the password, return a signed token.
router.post('/login', async (req, res) => {
  const { email, password } = parse(credentialsSchema, req.body, 422)

  const user = await users.findByEmail(email)
  // Always run a password check (against a real hash or the dummy) so both paths
  // take the same time. Same 401 message whether the email is unknown or the
  // password is wrong — we don't tell an attacker WHICH part was right, by text
  // OR by timing.
  const ok = verifyPassword(password, user ? user.password_hash : DUMMY_HASH)
  if (!user || !ok) {
    throw createError(401, 'Invalid email or password')
  }

  res.json({ token: signToken(user), user: { id: user.id, email: user.email } })
})

export default router
