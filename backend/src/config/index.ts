import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: parseInt(optional('PORT', '4000'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),

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

  pinata: {
    apiKey: optional('PINATA_API_KEY', ''),
    secretKey: optional('PINATA_SECRET_KEY', ''),
  },
} as const;
