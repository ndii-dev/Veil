import { createHash, timingSafeEqual } from 'crypto';
import type { RequestHandler } from 'express';
import { config } from '../config/index.js';

const digest = (s: string) => createHash('sha256').update(s).digest();

// Requires `Authorization: Bearer <ADMIN_API_KEY>`. If no key is configured the
// route is disabled rather than left open.
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!config.adminApiKey) {
    res.status(503).json({ error: 'ADMIN_API_KEY not configured; admin routes are disabled' });
    return;
  }

  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  // Compare fixed-length digests so neither content nor length leaks via timing.
  if (!token || !timingSafeEqual(digest(token), digest(config.adminApiKey))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};
