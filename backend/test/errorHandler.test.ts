import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/middleware/errorHandler.js';

function appThrowing(err: unknown) {
  const app = express();
  app.get('/', () => { throw err; });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('keeps 4xx/5xx statuses', async () => {
    const res = await request(appThrowing(Object.assign(new Error('nope'), { status: 418 }))).get('/');
    expect(res.status).toBe(418);
    expect(res.body.error).toBe('nope');
  });

  it('reads statusCode when status is missing', async () => {
    const res = await request(appThrowing(Object.assign(new Error('gone'), { statusCode: 410 }))).get('/');
    expect(res.status).toBe(410);
  });

  it('turns invalid statuses into 500', async () => {
    for (const status of [200, 302, '404', 1000]) {
      const res = await request(appThrowing(Object.assign(new Error('x'), { status }))).get('/');
      expect(res.status).toBe(500);
    }
  });
});
