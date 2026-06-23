import express from 'express';
import createError from "http-errors";
import bookRoutes from './routes/books.js';
import reviewRoutes from './routes/reviews.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  // health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  })

  app.use('/books', bookRoutes);
  app.use('/books/:bookId/reviews', reviewRoutes);



  app.use((req, res, next) => {
    next(createError(404, 'Not Found'));
  })

  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
      error: { status, message: err.expose ? err.message : 'Internal Server Error', detail: err.detail },
    })
  })

  return app;
}
