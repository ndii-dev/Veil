import type { ErrorRequestHandler } from 'express';
import { config } from '../config/index.js';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  // A response is already streaming; Express's default handler closes it.
  if (res.headersSent) {
    next(err);
    return;
  }

  // Only trust 4xx/5xx codes; anything else (missing, 200, a string) is a 500.
  const raw = (err as { status?: unknown; statusCode?: unknown }).status
    ?? (err as { statusCode?: unknown }).statusCode;
  const status = typeof raw === 'number' && Number.isInteger(raw) && raw >= 400 && raw <= 599 ? raw : 500;
  if (status >= 500) console.error(err);

  // Don't leak internal error messages (RPC URLs, stack details) in production.
  const message = status >= 500 && config.nodeEnv === 'production'
    ? 'Internal server error'
    : (err as Error).message ?? 'Internal server error';

  const body: { error: string; details?: unknown } = { error: message };
  if (err instanceof HttpError && err.details !== undefined) body.details = err.details;
  res.status(status).json(body);
};
