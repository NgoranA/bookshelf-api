// lib/passwords.js — hashing and checking passwords, WITHOUT any extra library.
//
// Golden rule: NEVER store a raw password. We store a one-way hash, so even if
// the database leaks, the actual passwords don't. We use Node's built-in
// `scrypt` (a deliberately slow, salted hashing function designed for this).
//
//   stored value = "<salt>:<hash>"
//
// The salt is a random value mixed into each hash so two users with the same
// password still get different hashes (and an attacker can't precompute a table
// of common-password hashes).

import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'

const KEYLEN = 64 // length of the derived hash, in bytes

export function hashPassword (password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEYLEN).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword (password, stored) {
  const [salt, hash] = stored.split(':')
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(password, salt, KEYLEN)
  // timingSafeEqual compares in constant time so an attacker can't learn the
  // hash byte-by-byte by measuring how long the comparison takes.
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
