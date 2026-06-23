// app.js — builds and configures the Express application (but does NOT start it).
//
// We export a function that creates the app. Keeping "build the app" separate
// from "start the server" (server.js) makes the app easy to test: a test can
// import createApp(), start it on a random free port, and tear it down.
//
// The middleware order matters. We read it top to bottom:
//   security headers → CORS → logging → JSON parsing → routes → 404 → errors.

import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { rateLimit } from 'express-rate-limit'
import pinoHttp from 'pino-http'
import createError from 'http-errors'

import authRoutes from './routes/auth.js'
import booksRoutes from './routes/books.js'
import reviewsRoutes from './routes/reviews.js'
import { mountDocs } from './routes/docs.js'
import { logger } from './lib/logger.js'
import { config } from './config.js'

export function createApp () {
  const app = express()

  // If we sit behind a proxy/load balancer in production, trust ONE hop so that
  // req.ip (used by rate limiting) reflects the real client, not the proxy.
  if (config.NODE_ENV === 'production') app.set('trust proxy', 1)

  // helmet sets a battery of safe security response headers in one line.
  // We disable its Content-Security-Policy because Swagger UI (/docs) uses inline
  // scripts/styles that a strict CSP would block. A real public API would lock
  // CSP down and host its docs separately.
  app.use(helmet({ contentSecurityPolicy: false }))

  // CORS decides which browser origins may call this API. Configure it per env.
  app.use(cors({ origin: config.CORS_ORIGIN }))

  // Structured request logging. Adds req.log and logs every request/response.
  app.use(pinoHttp({ logger }))

  // Parse JSON request bodies into req.body. Without this, req.body is undefined.
  app.use(express.json())

  // Liveness check + interactive docs. Registered BEFORE the rate limiter so they
  // are never throttled (handy for health probes and for loading the docs page).
  app.get('/health', (req, res) => res.json({ status: 'ok' }))
  mountDocs(app)

  // Basic abuse protection: cap requests per IP per minute. Past the limit the
  // client gets 429 Too Many Requests. (State is per-process & in-memory; a
  // multi-instance production deploy would use a shared store like Redis.)
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: config.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false
    })
  )

  // Feature routers, each mounted on a path.
  // /auth (register + login) is public — it's how clients GET a token. The books
  // and reviews routers require that token (they call requireUser internally).
  app.use('/auth', authRoutes)
  app.use('/books', booksRoutes)
  app.use('/books/:bookId/reviews', reviewsRoutes)

  // Anything that fell through is an unknown route → 404.
  app.use((req, res, next) => {
    next(createError(404, 'Route not found'))
  })

  // CENTRAL ERROR HANDLER (must have 4 args, and be registered LAST).
  // Every createError(...) thrown anywhere in the app lands here and becomes a
  // consistent JSON error response.
  app.use((err, req, res, next) => {
    const status = err.status || 500

    // Server errors (5xx) are OUR bug — log the full error so we can debug,
    // but never leak internal details (like raw SQL) to the client.
    if (status >= 500) {
      (req.log ?? logger).error({ err }, 'request failed')
    }

    res.status(status).json({
      error: {
        status,
        // http-errors marks 4xx messages as safe to show (err.expose === true).
        // For 5xx we send a generic message.
        message: err.expose ? err.message : 'Internal Server Error',
        // Extra validation detail, only present in non-production (see validate.js).
        detail: err.detail
      }
    })
  })

  return app
}

// Re-export config so server.js has one import for everything it needs.
export { config }
