import express from 'express';
import { pinoHttp } from 'pino-http';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { logger } from './lib/logger.js';
import createError from "http-errors";
import bookRoutes from './routes/books.js';
import reviewRoutes from './routes/reviews.js';
import { config } from './config/env-config.js';
import { authMiddleware } from './middlewares/auth.js';

export function createApp() {
  const app = express();

  if (config.NODE_ENV === 'production') app.set('trust proxy', 1); // trust first proxy
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(pinoHttp({ logger }));
  app.use(express.json());

  // health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  })

  app.use(rateLimit({ windowMs: config.RATE_LIMIT_WINDOW * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
  app.use('/books', authMiddleware, bookRoutes);
  app.use('/books/:bookId/reviews', reviewRoutes);



  app.use((req, res, next) => {
    next(createError(404, 'Not Found'));
  })

  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) (req.log ?? logger).error({ err }, 'request failed');
    res.status(status).json({
      error: { status, message: err.expose ? err.message : 'Internal Server Error', detail: err.detail },
    })
  })

  return app;
}
