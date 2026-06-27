# ShieldFund Backend

Express.js API backend for the ShieldFund ZK treasury platform.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + network info |
| GET | `/api/treasury/:contractId/balance` | Treasury vault balance |
| GET | `/api/treasury/:contractId/transactions` | Transaction history |
| GET | `/api/campaigns` | List all campaigns |
| GET | `/api/campaigns/:id` | Single campaign + metadata |
| POST | `/api/campaigns` | Cache campaign metadata |
| GET | `/api/proofs` | List on-chain proofs |
| GET | `/api/proofs/:proofId` | Single proof details |
| POST | `/api/proofs/verify` | Off-chain ZK proof pre-verification |
| GET | `/api/streams` | List active payment streams |
| GET | `/api/streams/:streamId` | Single stream |
| GET | `/api/streams/:streamId/claimable` | Claimable balance for a stream |

## Setup

```bash
cp .env.example .env
# fill in contract IDs after deploying shieldfund-contracts
npm install
npm run dev
```

## Related repos

- [shieldfund-frontend](https://github.com/Crowder-Stellar/shieldfund-frontend)
- [shieldfund-contracts](https://github.com/Crowder-Stellar/shieldfund-contracts)
