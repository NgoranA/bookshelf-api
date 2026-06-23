// logger.js — one shared, structured logger built on pino (very fast, JSON output).
//
// Why structured logging instead of console.log?
//   - JSON logs can be searched, filtered, and aggregated by tools in production.
//   - Each request gets a consistent format with useful context.
//   - We can turn the volume up/down with LOG_LEVEL without touching code.

import pino from 'pino'
import { config } from '../config.js'

export const logger = pino({
  level: config.LOG_LEVEL,
  // While developing, pretty-print colourful logs that humans can read.
  // In production we emit plain JSON (what log platforms ingest). In tests we
  // set LOG_LEVEL=silent so the test output stays clean.
  transport:
    config.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' }
        }
      : undefined
})
