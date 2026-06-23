// server.js — the entry point. Its only job is to start the HTTP server and
// shut it down cleanly. All the app logic lives in app.js.

import { createServer } from 'node:http'
import { createApp } from './app.js'
import { config } from './config.js'
import { db } from './db.js'
import { logger } from './lib/logger.js'

const app = createApp()
const server = createServer(app)

server.listen(config.PORT, () => {
  logger.info(`📚 Bookshelf API listening on http://localhost:${config.PORT}`)
  logger.info(`   Docs:   http://localhost:${config.PORT}/docs`)
  logger.info(`   Health: http://localhost:${config.PORT}/health`)
})

// Graceful shutdown: when the platform asks us to stop (Ctrl+C sends SIGINT,
// hosts send SIGTERM), stop accepting new connections and close the database
// pool before exiting. Otherwise the process can hang or drop in-flight work.
async function shutdown (signal) {
  logger.info(`${signal} received — shutting down gracefully...`)
  server.close()
  await db.end()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
