# ShieldFund Backend

Express.js API backend for the ShieldFund ZK treasury platform. Provides REST endpoints for reading on-chain state from the Soroban contracts, caching campaign metadata, and pre-verifying ZK proofs before they hit the chain.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js ≥ 20 |
| Framework | Express 4 |
| Language | TypeScript 5.8 |
| Stellar | `@stellar/stellar-sdk` v16 |
| Security | Helmet, CORS |
| Logging | Morgan |
| Dev runner | tsx (watch mode) |

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) |
| npm | ≥ 10 | bundled with Node |

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/Crowder-Stellar/shieldfund-backend.git
cd shieldfund-backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Fill in contract IDs (deploy shieldfund-contracts first)

# 4. Start dev server (auto-reloads on save)
npm run dev
# → http://localhost:4000
```

---

## Environment Variables

Copy `.env.example` to `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: `4000`) |
| `NODE_ENV` | No | `development` or `production` |
| `STELLAR_NETWORK` | Yes | `testnet` or `mainnet` |
| `STELLAR_HORIZON_URL` | Yes | Horizon REST API base URL |
| `STELLAR_RPC_URL` | Yes | Soroban RPC URL |
| `TREASURY_VAULT_CONTRACT_ID` | Yes | From shieldfund-contracts deploy |
| `STREAMING_CONTRACT_ID` | Yes | From shieldfund-contracts deploy |
| `PROOF_REGISTRY_CONTRACT_ID` | Yes | From shieldfund-contracts deploy |
| `PINATA_API_KEY` | No | For IPFS campaign metadata storage |
| `PINATA_SECRET_KEY` | No | For IPFS campaign metadata storage |

---

## Available Scripts

```bash
npm run dev      # Start dev server with hot reload (tsx watch)
npm run build    # Compile TypeScript → dist/
npm run start    # Run compiled output (production)
npm run lint     # TypeScript type-check (no emit)
```

---

## API Reference

### Health

```
GET /health
```
```json
{ "status": "ok", "network": "testnet" }
```

---

### Treasury

```
GET /api/treasury/:contractId/balance
```
Returns the live USDC balance held by a treasury vault contract.

```json
{ "contractId": "C...", "balance": "500000000000", "asset": "USDC" }
```

---

```
GET /api/treasury/:contractId/transactions?limit=20&cursor=
```
Paginated transaction history for a vault contract, indexed via Horizon.

```json
{
  "contractId": "C...",
  "transactions": [ /* ... */ ],
  "limit": 20,
  "cursor": null
}
```

---

### Campaigns

```
GET /api/campaigns
```
Lists all campaigns from on-chain contract state.

```json
{ "campaigns": [ { "id": "0", "title": "Relief Fund Q3", "goal": "100000000000" } ] }
```

---

```
GET /api/campaigns/:id
```
Returns a single campaign with its IPFS metadata merged in.

---

```
POST /api/campaigns
Content-Type: application/json

{
  "id": "1",
  "title": "Payroll Fund",
  "goal": "50000000000",
  "metadata": { "description": "...", "category": "payroll" }
}
```
Caches campaign metadata (IPFS or database). Returns `201 Created`.

---

### Proofs

```
GET /api/proofs
```
Lists all registered ZK proofs from the `proof_registry` contract.

```json
{
  "proofs": [
    {
      "id": 0,
      "proofHash": "abcdef...",
      "publicInputsHash": "123456...",
      "proofType": "payroll",
      "timestamp": 1719480000,
      "submitter": "G..."
    }
  ]
}
```

---

```
GET /api/proofs/:proofId
```
Returns a single proof entry by ID.

---

```
POST /api/proofs/verify
Content-Type: application/json

{
  "proof": "<hex-encoded Noir proof>",
  "publicInputs": ["0x...", "0x..."]
}
```
Off-chain ZK proof pre-verification before submitting on-chain. Returns:
```json
{ "valid": true }
```
or
```json
{ "valid": false, "error": "constraint not satisfied" }
```

---

### Streams

```
GET /api/streams
```
Lists all payment streams from the `streaming` contract.

```json
{
  "streams": [
    {
      "id": 0,
      "recipient": "G...",
      "flowRatePerSecond": "1929",
      "startTime": 1719480000,
      "endTime": 1722072000,
      "status": "Active"
    }
  ]
}
```

---

```
GET /api/streams/:streamId
```
Returns a single stream record.

---

```
GET /api/streams/:streamId/claimable
```
Returns the claimable USDC amount at the current ledger timestamp.

```json
{ "streamId": "0", "claimable": "125000000", "asset": "USDC" }
```

---

## Project Structure

```
shieldfund-backend/
├── package.json
├── tsconfig.json
├── .env.example                        # Environment variable template
├── .gitignore
│
└── src/
    ├── index.ts                        # Express app entry — mounts routers, middleware
    │
    ├── config/
    │   └── index.ts                    # Reads env vars, exports typed config object
    │
    ├── services/
    │   └── stellar.ts                  # Soroban RPC helpers — reads contract state
    │
    ├── types/
    │   └── index.ts                    # Shared TypeScript interfaces (Stream, Proof, etc.)
    │
    ├── routes/
    │   ├── treasury.ts                 # GET /api/treasury/...
    │   ├── campaigns.ts                # GET|POST /api/campaigns/...
    │   ├── proofs.ts                   # GET|POST /api/proofs/...
    │   └── streams.ts                  # GET /api/streams/...
    │
    └── middleware/
        └── errorHandler.ts             # Global error handler (status + message JSON)
```

---

## Error Responses

All errors return JSON with an `error` field:

```json
{ "error": "proof and publicInputs are required" }
```

HTTP status codes follow REST conventions: `400` bad request, `404` not found, `500` internal error.

---

## Connecting to Contracts

1. Deploy from [shieldfund-contracts](https://github.com/Crowder-Stellar/shieldfund-contracts)
2. Paste the printed contract IDs into `.env`
3. `src/config/index.ts` reads them and passes them to `src/services/stellar.ts`
4. The Stellar service uses `@stellar/stellar-sdk` to simulate contract reads via the Soroban RPC

---

## Related Repos

- [shieldfund-frontend](https://github.com/Crowder-Stellar/shieldfund-frontend) — React dashboard
- [shieldfund-contracts](https://github.com/Crowder-Stellar/shieldfund-contracts) — Soroban smart contracts (deploy first)
