import { describe, it, expect, vi, afterEach } from 'vitest';
import { proveWithProofServer } from '../src/services/proofServer.js';

const hex32 = (b: string) => '0x' + b.repeat(32);

const input = {
  recipientId: '42',
  amount: '500000',
  proofType: 'payroll' as const,
  allowlist: ['42'],
  budgetCap: '1000000',
  budgetSalt: '0x' + 'ab'.repeat(31),
};

const okBody = {
  valid: true,
  proofType: 'payroll',
  proofHash: hex32('a1'),
  publicInputsHash: hex32('b2'),
  publicInputs: ['0x1'],
  merkleRoot: '0x1',
  budgetCommitment: '0x2',
  recipientId: '0x2a',
  amount: '0x7a120',
};

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('proveWithProofServer', () => {
  it('maps a rejected key to 503', async () => {
    mockFetch(401, { error: 'invalid API key' });
    await expect(proveWithProofServer(input)).rejects.toMatchObject({ status: 503 });
  });

  it('maps circuit rejections to 422 with the reason', async () => {
    mockFetch(400, { error: 'amount exceeds budget' });
    await expect(proveWithProofServer(input)).rejects.toMatchObject({ status: 422, message: 'amount exceeds budget' });
  });
});
