# ShieldFund Backend

![CI](https://github.com/Crowder-Stellar/shieldfund-backend/actions/workflows/ci.yml/badge.svg)
![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue?logo=stellar)
![Node](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs)
![Express](https://img.shields.io/badge/Express-4-black?logo=express)

Express.js REST API for the ShieldFund ZK treasury platform. Reads live state from the Soroban contracts via simulation calls (no signing required), provides Horizon event indexing for transaction history, persists campaign metadata in SQLite, and anchors ZK proofs on-chain: it asks [shieldfund-proof-server](https://github.com/Crowder-Stellar/shieldfund-proof-server) to generate and `bb verify` a proof, then submits `register_proof()` from its own submitter key.

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
│       Port, CORS origins, admin key, network, RPC URLs, contract IDs,
│       proof server URL, submitter key, DB backups, Pinata JWT
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
│   │   ├── getStreams() / getStream()   paginated + direct reads
│   │   ├── getStreamAccumulated()
│   │   ├── getProofs() / getProof()     paginated + direct reads
│   │   ├── proofExists()
│   │   └── registerProof()  signs register_proof() with the submitter key
│   │
│   ├── proofServer.ts      ← client for shieldfund-proof-server POST /api/prove
│   ├── backup.ts           ← SQLite online snapshots + retention
│   │
│   └── db.ts               ← SQLite persistence (better-sqlite3)
│       ├── campaignDb.create()   create-only, never overwrites
│       ├── campaignDb.findById()
│       └── campaignDb.findAll()
│
├── src/routes/
│   ├── treasury.ts         GET /api/treasury/:contractId/balance|stats|transactions
│   ├── campaigns.ts        GET|POST /api/campaigns, GET /api/campaigns/:id
│   ├── proofs.ts           GET /api/proofs, GET /api/proofs/:id, POST /api/proofs (admin)
│   ├── schemas.ts          zod schemas for every route's params, query, and body
│   └── streams.ts          GET /api/streams, GET /api/streams/:id/claimable
│
└── src/middleware/
    ├── errorHandler.ts     JSON error responses with HTTP status codes
    ├── auth.ts             Bearer ADMIN_API_KEY check for admin write routes
    ├── rateLimit.ts        Rate limit on every write route
    └── validate.ts         zod parse → 400 with issue list
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

### Generate and anchor a ZK proof (admin)

```bash
curl -X POST http://localhost:4000/api/proofs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{
    "recipientId": "42",
    "amount": "500000",
    "proofType": "payroll",
    "allowlist": ["42", "43", "44"],
    "budgetCap": "1000000",
    "budgetSalt": "777"
  }'
```
```json
{
  "proofId": 7,
  "txHash": "3f1c...",
  "proofType": "payroll",
  "proofHash": "0x9b2e...",
  "publicInputsHash": "0x51d0...",
  "publicInputs": ["0x045c...", "0x2484...", "0x...2a", "0x...7a120", "0x...0"],
  "merkleRoot": "0x045c...",
  "budgetCommitment": "0x2484...",
  "budgetSalt": "777"
}
```

The backend forwards the circuit inputs to the proof server, which only returns a proof after `bb verify`
accepts it. The backend then checks the hash isn't already registered (`409`) and submits
`proof_registry.register_proof()` signed by `PROOF_SUBMITTER_SECRET`. Clients never send a proof hash.
If the circuit rejects the inputs (recipient not on the allowlist, amount over budget) the response is `422`.

> Submissions are serialized in-process, because they all spend from the one submitter account's sequence
> number and concurrent ones would be rejected (`TRY_AGAIN_LATER` / `txBadSeq`). If you run several backend
> replicas, give each its own submitter key or route anchoring through one instance.
>
> `proof_registry` only accepts submissions from its admin, so the submitter key must be the registry admin
> (use `transfer_admin` to hand the role to a dedicated key). The server logs a warning at startup if it isn't.
>
> The old `POST /api/proofs/verify` stub has been removed. It never verified anything and must not be
> relied on.

### Cache campaign metadata

```bash
curl -X POST http://localhost:4000/api/campaigns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
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
| `POST` | `/api/campaigns` | **Admin.** Create campaign metadata (body: `{ id, title, goal, metadata? }`). `409` if the id exists. |

### Proofs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/proofs?start=0&limit=50` | Page of registered proofs (`limit` 1–100) → `{ proofs, total, start, limit }` |
| `GET` | `/api/proofs/:proofId` | Single proof by sequential ID (direct `get_proof` lookup) |
| `POST` | `/api/proofs` | **Admin.** Prove via proof server, then anchor with `register_proof()` (body: `{ recipientId, amount, proofType, allowlist, budgetCap, budgetSalt? }`) |

### Streams

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/streams?start=0&limit=50` | Page of streams (`limit` 1–100) → `{ streams, total, start, limit }` |
| `GET` | `/api/streams/:streamId` | Single stream record (direct `get_stream` lookup) |
| `GET` | `/api/streams/:streamId/claimable` | Live claimable amount via simulation call |


List endpoints use the contracts' paginated `get_*_count` / `get_proofs` / `get_streams(start, limit)` reads,
and single-item endpoints call `get_proof` / `get_stream` directly instead of downloading every record.
Contracts deployed before pagination existed are detected once (missing `get_*_count`) and fall back to the
old `get_all_*` getters, so the API behaves the same against either deployment.
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
| `CORS_ORIGINS` | localhost dev ports | Comma-separated allowed frontend origins. **Required in production.** |
| `TRUST_PROXY` | `0` | Reverse-proxy hops in front of the app (e.g. `1` on Railway) so rate limits use the real client IP |
| `ADMIN_API_KEY` | — | Bearer token for admin write routes. Unset = those routes return `503`. |
| `WRITE_RATE_LIMIT_WINDOW_MS` | `900000` | Rate-limit window for write routes |
| `WRITE_RATE_LIMIT_MAX` | `30` | Max write requests per IP per window |
| `PROOF_SERVER_URL` | `http://localhost:4100` | shieldfund-proof-server base URL |
| `PROOF_SERVER_TIMEOUT_MS` | `120000` | Timeout for proof generation |
| `PROOF_SUBMITTER_SECRET` | — | Secret seed of the dedicated key that signs `register_proof()`; must be the registry admin |
| `DB_PATH` | `./data/shieldfund.db` | SQLite file path |
| `DB_BACKUP_DIR` | — | Directory for periodic SQLite snapshots. Unset = no automatic backups. |
| `DB_BACKUP_INTERVAL_MINUTES` | `60` | Snapshot interval |
| `DB_BACKUP_KEEP` | `48` | Snapshots to retain |
| `PINATA_JWT` | — | Optional. Scoped Pinata JWT with pin-only permissions. Server-side only. |

---

## Available Scripts

```bash
npm run dev      # Hot-reload dev server (tsx watch)
npm run build    # TypeScript → dist/
npm run start    # Run compiled output (production)
npm run lint     # Type-check only
npm test         # API test suite (vitest + supertest; Stellar & proof server mocked)
npm run db:backup [dir]   # One-off SQLite snapshot (default: $DB_BACKUP_DIR or ./backups)
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
    ├── app.ts                    # Express app — mounts routes, middleware (no listen)
    ├── index.ts                  # Entrypoint — listens, starts backups
    │
    ├── config/
    │   └── index.ts              # All env vars → typed config object
    │
    ├── types/
    │   └── index.ts              # Stream, Proof, VaultStats, Campaign, ApiError
    │
    ├── services/
    │   ├── stellar.ts            # Soroban RPC reads + register_proof() submission
    │   ├── proofServer.ts        # shieldfund-proof-server client
    │   ├── backup.ts             # SQLite snapshots
    │   └── db.ts                 # SQLite campaign store (better-sqlite3)
    │
    ├── routes/
    │   ├── treasury.ts
    │   ├── campaigns.ts
    │   ├── proofs.ts
    │   ├── streams.ts
    │   └── schemas.ts            # zod request schemas
    │
    ├── scripts/
    │   └── backupDb.ts           # npm run db:backup
    │
    └── middleware/
        ├── errorHandler.ts       # Global error → { error: string } + status code
        ├── auth.ts               # Admin bearer token
        ├── rateLimit.ts          # Write-route rate limiting
        └── validate.ts           # zod → 400
```

---

## Error Responses

All errors return JSON:

```json
{ "error": "human-readable message" }
```

| Status | When |
|--------|------|
| `400` | Invalid params, query, or body (`details` lists each zod issue) |
| `401` | Missing or wrong admin bearer token |
| `404` | Resource not found |
| `409` | Campaign id already exists, or proof hash already registered on-chain |
| `422` | Proof server's circuit rejected the inputs |
| `429` | Write rate limit exceeded |
| `502` | Proof server unreachable or returned an invalid response |
| `503` | Contract ID, admin key, or submitter key not configured |
| `500` | Unexpected server error |

---

## CI / Deploy

GitHub Actions on every push and PR:
- **Type-check** (`tsc --noEmit`), **tests** (`npm test`) + **build** on every event
- **Railway deploy** on push to `main` (requires `RAILWAY_TOKEN` secret)

### Before hosting

- **Persist the database.** `data/shieldfund.db` lives on the container's filesystem, which Railway
  wipes on every deploy. Either mount a Railway volume and point `DB_PATH` and `DB_BACKUP_DIR` at it, or
  move to a managed database (Postgres). The backups should go to separate storage from the DB itself.
- **Set** `NODE_ENV=production`, `CORS_ORIGINS`, `TRUST_PROXY=1`, `ADMIN_API_KEY`, and `PROOF_SUBMITTER_SECRET`
  as Railway variables. Never commit them.
- **Pinata:** use a scoped JWT that can only pin (`pinFileToIPFS`, `pinJSONToIPFS`), not an
  unrestricted API key/secret pair.

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
- [shieldfund-proof-server](https://github.com/Crowder-Stellar/shieldfund-proof-server) — Noir proof generation + `bb verify`
