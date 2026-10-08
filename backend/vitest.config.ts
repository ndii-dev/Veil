import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Each file gets a fresh module graph, so per-file env (e.g. a low rate
    // limit) and the in-memory SQLite DB don't leak between files.
    isolate: true,
    env: {
      NODE_ENV: 'test',
      ADMIN_API_KEY: 'test-admin-key',
      CORS_ORIGINS: 'https://app.example',
      DB_PATH: ':memory:',
      WRITE_RATE_LIMIT_MAX: '1000',
      PROOF_REGISTRY_CONTRACT_ID: 'CBDLHQQPKC5524CFWPD4HMPTZGWBYQNW3IKGAFH6IAYBU3F2F6AO2332',
      STREAMING_CONTRACT_ID: 'CDU7ZIVQ3UC4K3DHV3NMQGW5UMSYFCKCC6YJKHT4YLNEZJRWL6THE6WQ',
      TREASURY_VAULT_CONTRACT_ID: 'CAUWJPC73YLQMSV6X4QPLUVS2UZFE2PMRIQSSCDN62DNN6J76Y5RETIG',
    },
  },
});
