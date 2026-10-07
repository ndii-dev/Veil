import { z } from 'zod';
import { HttpError } from './errorHandler.js';

// Parses `value` against `schema`, throwing a 400 with the zod issues on failure.
export function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(
      400,
      'Invalid request',
      result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}
