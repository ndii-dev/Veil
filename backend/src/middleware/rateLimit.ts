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

// Applied to /api reads (GET/HEAD); /health is outside /api and not limited.
export const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rateLimit.readMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: req => req.method !== 'GET' && req.method !== 'HEAD',
  message: { error: 'Too many requests, please try again later' },
});
