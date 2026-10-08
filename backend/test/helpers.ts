import { vi } from 'vitest';

// Network-facing services are mocked so the suite runs offline and fast.
vi.mock('../src/services/stellar.js', () => ({
  getVaultBalance: vi.fn(async () => '1000'),
  getVaultStats: vi.fn(async () => ({ vaultBalance: '1000', totalRaised: '2000', totalDisbursed: '1000' })),
  getContractEvents: vi.fn(async () => []),
  getStreams: vi.fn(async () => ({ items: [], total: 0 })),
  getStream: vi.fn(async () => null),
  getStreamAccumulated: vi.fn(async () => '0'),
  getProofs: vi.fn(async () => ({ items: [], total: 0 })),
  getProof: vi.fn(async () => null),
  proofExists: vi.fn(async () => false),
  registerProof: vi.fn(async () => ({ proofId: 7, txHash: 'ab'.repeat(32) })),
  checkSubmitterIsRegistryAdmin: vi.fn(async () => undefined),
}));

vi.mock('../src/services/proofServer.js', () => ({
  proveWithProofServer: vi.fn(),
}));

export const ADMIN = { Authorization: 'Bearer test-admin-key' };
export const hex32 = (byte: string) => '0x' + byte.repeat(32);
