import './helpers.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as stellar from '../src/services/stellar.js';
import * as proofServer from '../src/services/proofServer.js';
import { HttpError } from '../src/middleware/errorHandler.js';
import { ADMIN, hex32 } from './helpers.js';

const mocked = vi.mocked;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('health & routing', () => {
  it('reports health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', network: 'testnet' });
  });

  it('returns JSON 404 for unknown routes, including the removed /api/proofs/verify', async () => {
    expect((await request(app).get('/nope')).status).toBe(404);
    const res = await request(app).post('/api/proofs/verify').send({});
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app).post('/api/campaigns').set(ADMIN)
      .set('content-type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });
});

describe('CORS', () => {
  it('allows the configured frontend origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://app.example');
    expect(res.headers['access-control-allow-origin']).toBe('https://app.example');
  });

  it('does not allow other origins', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('campaigns', () => {
  const campaign = { id: 'relief-q4', title: 'Relief Q4', goal: '25000000000', metadata: { description: 'x' } };

  it('requires the admin bearer token to create', async () => {
    expect((await request(app).post('/api/campaigns').send(campaign)).status).toBe(401);
    expect((await request(app).post('/api/campaigns').set('Authorization', 'Bearer wrong').send(campaign)).status).toBe(401);
  });

  it('validates the body with zod', async () => {
    const res = await request(app).post('/api/campaigns').set(ADMIN)
      .send({ id: 'bad id!', title: '', goal: '1.5', extra: true });
    expect(res.status).toBe(400);
    const paths = res.body.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['id', 'title', 'goal', '']));
  });

  it('creates once, refuses to overwrite, and reads back', async () => {
    const created = await request(app).post('/api/campaigns').set(ADMIN).send(campaign);
    expect(created.status).toBe(201);

    const overwrite = await request(app).post('/api/campaigns').set(ADMIN).send({ ...campaign, title: 'HIJACKED' });
    expect(overwrite.status).toBe(409);

    const one = await request(app).get('/api/campaigns/relief-q4');
    expect(one.body.campaign).toEqual(campaign);
    const all = await request(app).get('/api/campaigns');
    expect(all.body.campaigns.map((c: { id: string }) => c.id)).toContain('relief-q4');
  });

  it('404s unknown campaigns', async () => {
    expect((await request(app).get('/api/campaigns/missing')).status).toBe(404);
  });
});

describe('proofs', () => {
  const proveResult = {
    valid: true as const, proofType: 'payroll' as const,
    proofHash: hex32('a1'), publicInputsHash: hex32('b2'), publicInputs: ['0x1'],
    merkleRoot: '0x1', budgetCommitment: '0x2', budgetSalt: '777', recipientId: '0x2a', amount: '0x1',
  };
  const input = { recipientId: '42', amount: '500000', proofType: 'payroll', allowlist: ['42'], budgetCap: '1000000' };

  it('lists a page and validates paging params', async () => {
    mocked(stellar.getProofs).mockResolvedValueOnce({ items: [], total: 3 });
    const res = await request(app).get('/api/proofs?start=1&limit=2');
    expect(res.body).toEqual({ proofs: [], total: 3, start: 1, limit: 2 });
    expect(stellar.getProofs).toHaveBeenCalledWith(expect.any(String), 1, 2);

    expect((await request(app).get('/api/proofs?limit=0')).status).toBe(400);
    expect((await request(app).get('/api/proofs?limit=101')).status).toBe(400);
    expect((await request(app).get('/api/proofs?bogus=1')).status).toBe(400);
  });

  it('404s an unknown proof id and 400s a non-numeric one', async () => {
    expect((await request(app).get('/api/proofs/5')).status).toBe(404);
    expect((await request(app).get('/api/proofs/abc')).status).toBe(400);
  });

  it('anchors: proves via the proof server, then registers on-chain', async () => {
    mocked(proofServer.proveWithProofServer).mockResolvedValueOnce(proveResult);
    const res = await request(app).post('/api/proofs').set(ADMIN).send(input);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ proofId: 7, proofHash: proveResult.proofHash });
    expect(proofServer.proveWithProofServer).toHaveBeenCalledWith(input);
    expect(stellar.registerProof).toHaveBeenCalledWith(
      expect.any(String), proveResult.proofHash, proveResult.publicInputsHash, 'payroll',
    );
  });

  it('never accepts a proof hash from the client', async () => {
    const res = await request(app).post('/api/proofs').set(ADMIN).send({ ...input, proofHash: hex32('ff') });
    expect(res.status).toBe(400);
    expect(proofServer.proveWithProofServer).not.toHaveBeenCalled();
    expect(stellar.registerProof).not.toHaveBeenCalled();
  });

  it('requires admin auth to anchor', async () => {
    expect((await request(app).post('/api/proofs').send(input)).status).toBe(401);
    expect(proofServer.proveWithProofServer).not.toHaveBeenCalled();
  });

  it('409s when the proof is already registered, without submitting', async () => {
    mocked(proofServer.proveWithProofServer).mockResolvedValueOnce(proveResult);
    mocked(stellar.proofExists).mockResolvedValueOnce(true);
    const res = await request(app).post('/api/proofs').set(ADMIN).send(input);
    expect(res.status).toBe(409);
    expect(stellar.registerProof).not.toHaveBeenCalled();
  });

  it('passes proof-server rejections through with their status', async () => {
    mocked(proofServer.proveWithProofServer).mockRejectedValueOnce(new HttpError(422, 'amount exceeds budget'));
    const res = await request(app).post('/api/proofs').set(ADMIN).send(input);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('amount exceeds budget');
    expect(stellar.registerProof).not.toHaveBeenCalled();
  });
});

describe('streams & treasury', () => {
  it('404s an unknown stream and validates ids', async () => {
    expect((await request(app).get('/api/streams/3')).status).toBe(404);
    expect((await request(app).get('/api/streams/-1')).status).toBe(400);
  });

  it('rejects contract ids that are not C... addresses', async () => {
    const res = await request(app).get('/api/treasury/not-a-contract/balance');
    expect(res.status).toBe(400);
    expect(stellar.getVaultBalance).not.toHaveBeenCalled();
  });

  it('resolves "default" to the configured vault', async () => {
    const res = await request(app).get('/api/treasury/default/stats');
    expect(res.status).toBe(200);
    expect(res.body.contractId).toBe(process.env.TREASURY_VAULT_CONTRACT_ID);
  });
});
