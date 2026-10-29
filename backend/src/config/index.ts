import 'dotenv/config';

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

// Reads a non-negative integer, failing at startup on typos like PORT=abc
// instead of silently running with NaN.
function int(key: string, fallback: number, min = 0): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) {
    throw new Error(`${key} must be an integer >= ${min}, got "${raw}"`);
  }
  return n;
}

function list(key: string): string[] {
  return optional(key, '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

const nodeEnv = optional('NODE_ENV', 'development');

// Browser origins allowed to call the API. In development the Vite dev server
// is allowed by default; in production CORS_ORIGINS must be set explicitly.
const corsOrigins = list('CORS_ORIGINS');
if (corsOrigins.length === 0) {
  if (nodeEnv === 'production') {
    throw new Error('CORS_ORIGINS must be set in production (comma-separated list of frontend origins)');
  }
  corsOrigins.push('http://localhost:5173', 'http://localhost:3000');
}

export const config = {
  port: int('PORT', 4000),
  nodeEnv,
  corsOrigins,
  // Number of reverse-proxy hops in front of the app (e.g. 1 on Railway), so
  // rate limiting keys on the real client IP rather than the proxy's.
  trustProxy: int('TRUST_PROXY', 0),

  // Bearer token required on admin-only write routes (campaign creation,
  // proof anchoring). Unset = those routes are disabled (503).
  adminApiKey: optional('ADMIN_API_KEY', ''),

  rateLimit: {
    windowMs: int('WRITE_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, 1),
    max: int('WRITE_RATE_LIMIT_MAX', 30, 1),
  },

  stellar: {
    network: optional('STELLAR_NETWORK', 'testnet') as 'testnet' | 'mainnet',
    horizonUrl: optional('STELLAR_HORIZON_URL', 'https://horizon-testnet.stellar.org'),
    rpcUrl: optional('STELLAR_RPC_URL', 'https://soroban-testnet.stellar.org'),
  },

  contracts: {
    treasuryVault: optional('TREASURY_VAULT_CONTRACT_ID', ''),
    streaming: optional('STREAMING_CONTRACT_ID', ''),
    proofRegistry: optional('PROOF_REGISTRY_CONTRACT_ID', ''),
  },

  proofs: {
    // shieldfund-proof-server base URL — generates and `bb verify`s proofs.
    serverUrl: optional('PROOF_SERVER_URL', 'http://localhost:4100'),
    serverTimeoutMs: int('PROOF_SERVER_TIMEOUT_MS', 120_000, 1),
    // One of the proof server's PROVE_API_KEYS, sent as X-API-Key. The proof
    // server refuses every /api/prove request without a valid key.
    serverApiKey: optional('PROOF_SERVER_API_KEY', ''),
    // Secret seed (S...) of the dedicated key that signs register_proof().
    // proof_registry only accepts submissions from its admin address, so this
    // key must be (or be made, via transfer_admin) the registry admin.
    submitterSecret: optional('PROOF_SUBMITTER_SECRET', ''),
  },

  db: {
    // Directory for periodic SQLite snapshots; unset disables them.
    backupDir: optional('DB_BACKUP_DIR', ''),
    backupIntervalMinutes: int('DB_BACKUP_INTERVAL_MINUTES', 60),
    backupKeep: int('DB_BACKUP_KEEP', 48),
  },

  pinata: {
    // Scoped Pinata JWT limited to pinning (pinFileToIPFS / pinJSONToIPFS).
    // Server-side only — never expose it to the frontend.
    jwt: optional('PINATA_JWT', ''),
  },
} as const;
