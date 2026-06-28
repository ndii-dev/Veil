# ShieldFund Backend

![CI](https://github.com/Crowder-Stellar/shieldfund-backend/actions/workflows/ci.yml/badge.svg)
![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue?logo=stellar)
![Node](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs)
![Express](https://img.shields.io/badge/Express-4-black?logo=express)

Express.js REST API for the ShieldFund ZK treasury platform. Reads live state from the Soroban contracts via simulation calls (no signing required), provides Horizon event indexing for transaction history, persists campaign metadata in SQLite, and pre-validates ZK proofs before they hit the chain.

---

## Live Testnet Contracts

The backend is pre-configured to read from these testnet contracts:

| Contract | ID |
|----------|----|
| Treasury Vault | `CAUWJPC73YLQMSV6X4QPLUVS2UZFE2PMRIQSSCDN62DNN6J76Y5RETIG` |
| Streaming | `CDU7ZIVQ3UC4K3DHV3NMQGW5UMSYFCKCC6YJKHT4YLNEZJRWL6THE6WQ` |
| Proof Registry | `CBDLHQQPKC5524CFWPD4HMPTZGWBYQNW3IKGAFH6IAYBU3F2F6AO2332` |

Explorer links: [Stellar Expert (testnet)](https://stellar.expert/explorer/testnet)

---

## Work Breakdown Structure

```
shieldfund-backend
│
├── src/config/index.ts
│   └── Reads all env vars into a typed config object
│       Port, network, RPC URLs, contract IDs, Pinata keys
│
├── src/types/index.ts
│   └── Shared interfaces: Stream, Proof, VaultStats, Campaign, ApiError
│
├── src/services/
│   ├── stellar.ts          ← Soroban RPC layer
│   │   ├── simulateRead()  builds + submits simulation txn (no fee, no signing)
│   │   ├── getVaultBalance()
│   │   ├── getVaultStats()
│   │   ├── getContractEvents()   Horizon event indexing
│   │   ├── getAllStreams()
│   │   ├── getStreamAccumulated()
│   │   ├── getAllProofs()
│   │   └── proofExists()
│   │
│   └── db.ts               ← SQLite persistence (better-sqlite3)
│       ├── campaignDb.upsert()
│       ├── campaignDb.findById()
│       └── campaignDb.findAll()
│
├── src/routes/
│   ├── treasury.ts         GET /api/treasury/:contractId/balance|stats|transactions
│   ├── campaigns.ts        GET|POST /api/campaigns, GET /api/campaigns/:id
│   ├── proofs.ts           GET /api/proofs, GET /api/proofs/:id, POST /api/proofs/verify
│   └── streams.ts          GET /api/streams, GET /api/streams/:id/claimable
│
└── src/middleware/
    └── errorHandler.ts     JSON error responses with HTTP status codes
```

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/Crowder-Stellar/shieldfund-backend.git
cd shieldfund-backend

# 2. Install
npm install

# 3. Configure (testnet contract IDs already filled in)
cp .env.example .env

# 4. Start dev server with hot reload
npm run dev
# → http://localhost:4000
```

---

## How to Use

### Health check — verify the server is running

```bash
curl http://localhost:4000/health
```
```json
{ "status": "ok", "network": "testnet" }
```

### Read vault stats from the live testnet contract

```bash
curl http://localhost:4000/api/treasury/default/stats
```
```json
{
  "contractId": "CAUWJPC73YLQMSV6X4QPLUVS2UZFE2PMRIQSSCDN62DNN6J76Y5RETIG",
  "vaultBalance": "0",
  "totalRaised": "0",
  "totalDisbursed": "0"
}
```

### Read vault balance (stroops)

```bash
curl http://localhost:4000/api/treasury/default/balance
```
```json
{ "contractId": "CAUWJ...", "balance": "100000000", "asset": "USDC" }
```

### List all payment streams

```bash
curl http://localhost:4000/api/streams
```
```json
{
  "streams": [
    {
      "id": 0,
      "recipient": "GABCD...",
      "flowRatePerSecond": "19291",
      "startTime": 1751000000,
      "endTime": 1753592000,
      "accumulated": "0",
      "status": "Active"
    }
  ]
}
```

### Check claimable balance for a stream

```bash
curl http://localhost:4000/api/streams/0/claimable
```
```json
{ "streamId": "0", "claimable": "12540000", "asset": "USDC" }
```

### List all on-chain ZK proofs

```bash
curl http://localhost:4000/api/proofs
```
```json
{
  "proofs": [
    {
      "id": 0,
      "proofHash": "abcdef12...",
      "publicInputsHash": "123456ab...",
      "proofType": "payroll",
      "timestamp": 1751000100,
      "submitter": "GBJ5FP..."
    }
  ]
}
```

### Pre-verify a ZK proof before submitting on-chain

```bash
curl -X POST http://localhost:4000/api/proofs/verify \
  -H "Content-Type: application/json" \
  -d '{
    "proof": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "publicInputs": ["0x01", "0x02"]
  }'
```
```json
{ "valid": false, "message": "Verifier not yet wired up — register proof on-chain directly" }
```

> The pre-verification endpoint checks for duplicate hashes on-chain first (`409 Conflict` if already registered), then runs the Noir verifier circuit (circuit integration is the next implementation step).

### Cache campaign metadata

```bash
curl -X POST http://localhost:4000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "id": "1",
    "title": "Global Relief Fund Q3",
    "goal": "500000000000",
    "metadata": { "description": "Emergency relief disbursements", "category": "relief" }
  }'
```
```json
{ "id": "1", "status": "created" }
```

Then fetch it:
```bash
curl http://localhost:4000/api/campaigns/1
```

---

## Full API Reference

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server status + active network |

### Treasury

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/treasury/:contractId/balance` | Live token balance (stroops). Use `default` for the configured vault. |
| `GET` | `/api/treasury/:contractId/stats` | `{ vaultBalance, totalRaised, totalDisbursed }` |
| `GET` | `/api/treasury/:contractId/transactions?limit=20&cursor=` | Horizon contract event log, paginated |

### Campaigns

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/campaigns` | All campaigns from SQLite |
| `GET` | `/api/campaigns/:id` | Single campaign |
| `POST` | `/api/campaigns` | Upsert campaign metadata (body: `{ id, title, goal, metadata? }`) |

### Proofs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/proofs` | All registered proofs from proof_registry contract |
| `GET` | `/api/proofs/:proofId` | Single proof by sequential ID |
| `POST` | `/api/proofs/verify` | Pre-verify ZK proof (body: `{ proof, publicInputs }`) |

### Streams

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/streams` | All streams from streaming contract |
| `GET` | `/api/streams/:streamId` | Single stream record |
| `GET` | `/api/streams/:streamId/claimable` | Live claimable amount via simulation call |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |
| `NODE_ENV` | `development` | `development` or `production` |
| `STELLAR_NETWORK` | `testnet` | `testnet` or `mainnet` |
| `STELLAR_HORIZON_URL` | testnet URL | Horizon REST API |
| `STELLAR_RPC_URL` | testnet URL | Soroban RPC URL |
| `TREASURY_VAULT_CONTRACT_ID` | set | Vault contract address |
| `STREAMING_CONTRACT_ID` | set | Streaming contract address |
| `PROOF_REGISTRY_CONTRACT_ID` | set | Proof registry contract address |
| `DB_PATH` | `./data/shieldfund.db` | SQLite file path |
| `PINATA_API_KEY` | — | Optional IPFS storage |
| `PINATA_SECRET_KEY` | — | Optional IPFS storage |

---

## Available Scripts

```bash
npm run dev      # Hot-reload dev server (tsx watch)
npm run build    # TypeScript → dist/
npm run start    # Run compiled output (production)
npm run lint     # Type-check only
```

---

## Project Structure

```
shieldfund-backend/
├── package.json
├── tsconfig.json
├── .env.example                  # Testnet contract IDs pre-filled
├── .gitignore                    # Excludes node_modules, dist, .env, data/
│
└── src/
    ├── index.ts                  # Express app — mounts routes, middleware
    │
    ├── config/
    │   └── index.ts              # All env vars → typed config object
    │
    ├── types/
    │   └── index.ts              # Stream, Proof, VaultStats, Campaign, ApiError
    │
    ├── services/
    │   ├── stellar.ts            # Soroban RPC simulation helpers
    │   └── db.ts                 # SQLite campaign store (better-sqlite3)
    │
    ├── routes/
    │   ├── treasury.ts
    │   ├── campaigns.ts
    │   ├── proofs.ts
    │   └── streams.ts
    │
    └── middleware/
        └── errorHandler.ts       # Global error → { error: string } + status code
```

---

## Error Responses

All errors return JSON:

```json
{ "error": "human-readable message" }
```

| Status | When |
|--------|------|
| `400` | Missing or invalid request body |
| `404` | Resource not found |
| `409` | Duplicate proof hash already registered on-chain |
| `503` | Contract ID not configured |
| `500` | Unexpected server error |

---

## CI / Deploy

GitHub Actions on every push and PR:
- **Type-check** (`tsc --noEmit`) + **build** on every event
- **Railway deploy** on push to `main` (requires `RAILWAY_TOKEN` secret)

To deploy to Railway manually:
```bash
npm install -g @railway/cli
railway login
railway up
```

---

## Related Repos

- [shieldfund-frontend](https://github.com/Crowder-Stellar/shieldfund-frontend) — React dashboard
- [shieldfund-contracts](https://github.com/Crowder-Stellar/shieldfund-contracts) — Soroban smart contracts
