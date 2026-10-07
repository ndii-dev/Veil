import 'dotenv/config';

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
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
  port: parseInt(optional('PORT', '4000'), 10),
  nodeEnv,
  corsOrigins,
  // Number of reverse-proxy hops in front of the app (e.g. 1 on Railway), so
  // rate limiting keys on the real client IP rather than the proxy's.
  trustProxy: parseInt(optional('TRUST_PROXY', '0'), 10),

  // Bearer token required on admin-only write routes (campaign creation,
  // proof anchoring). Unset = those routes are disabled (503).
  adminApiKey: optional('ADMIN_API_KEY', ''),

  rateLimit: {
    windowMs: parseInt(optional('WRITE_RATE_LIMIT_WINDOW_MS', String(15 * 60 * 1000)), 10),
    max: parseInt(optional('WRITE_RATE_LIMIT_MAX', '30'), 10),
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
    serverTimeoutMs: parseInt(optional('PROOF_SERVER_TIMEOUT_MS', '120000'), 10),
    // Secret seed (S...) of the dedicated key that signs register_proof().
    // proof_registry only accepts submissions from its admin address, so this
    // key must be (or be made, via transfer_admin) the registry admin.
    submitterSecret: optional('PROOF_SUBMITTER_SECRET', ''),
  },

  db: {
    // Directory for periodic SQLite snapshots; unset disables them.
    backupDir: optional('DB_BACKUP_DIR', ''),
    backupIntervalMinutes: parseInt(optional('DB_BACKUP_INTERVAL_MINUTES', '60'), 10),
    backupKeep: parseInt(optional('DB_BACKUP_KEEP', '48'), 10),
  },

  pinata: {
    // Scoped Pinata JWT limited to pinning (pinFileToIPFS / pinJSONToIPFS).
    // Server-side only — never expose it to the frontend.
    jwt: optional('PINATA_JWT', ''),
  },
} as const;
