import createError from 'http-errors';
import { config } from '../config/env-config.js';


export function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  if (!token || token !== config.API_KEY) return next(createError(401, 'Unauthorized'));
  next();
}
