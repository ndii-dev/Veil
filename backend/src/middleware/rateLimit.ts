import { rateLimit } from 'express-rate-limit';
import { config } from '../config/index.js';

// Applied to every write route (POST/PUT/PATCH/DELETE).
export const writeLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: req => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: { error: 'Too many requests, please try again later' },
});
