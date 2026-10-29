import './helpers.js';
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

let app: Express;

beforeAll(async () => {
  // Must be set before the config module loads.
  process.env.WRITE_RATE_LIMIT_MAX = '2';
  process.env.READ_RATE_LIMIT_MAX = '3';
  ({ app } = await import('../src/app.js'));
});

describe('write rate limiting', () => {
  it('limits writes per IP but not reads', async () => {
    const write = () => request(app).post('/api/campaigns').send({});
    expect((await write()).status).toBe(401);
    expect((await write()).status).toBe(401);
    expect((await write()).status).toBe(429);

    for (let i = 0; i < 5; i++) {
      expect((await request(app).get('/health')).status).toBe(200);
    }
  });
});

describe('read rate limiting', () => {
  it('limits /api reads per IP, but never /health', async () => {
    for (let i = 0; i < 3; i++) {
      expect((await request(app).get('/api/campaigns')).status).toBe(200);
    }
    expect((await request(app).get('/api/campaigns')).status).toBe(429);
    expect((await request(app).get('/health')).status).toBe(200);
  });
});
