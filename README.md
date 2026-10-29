# Veil

[![Contracts](https://github.com/ndii-dev/Veil/actions/workflows/contracts.yml/badge.svg)](https://github.com/ndii-dev/Veil/actions/workflows/contracts.yml)
[![Backend](https://github.com/ndii-dev/Veil/actions/workflows/backend.yml/badge.svg)](https://github.com/ndii-dev/Veil/actions/workflows/backend.yml)
[![Proof Server](https://github.com/ndii-dev/Veil/actions/workflows/proof-server.yml/badge.svg)](https://github.com/ndii-dev/Veil/actions/workflows/proof-server.yml)
![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue?logo=stellar)
![License](https://img.shields.io/badge/license-MIT-green)

**Private treasury management on Stellar.** Veil lets an organisation hold funds, stream payroll and
pay out grants on-chain, while proving with zero-knowledge proofs that each payment follows the rules
(approved recipient, within budget) without publishing the full recipient list or the budget itself.

This monorepo holds the whole stack: Soroban smart contracts, the API backend, and the Noir proof server.

---

## Repository layout

| Folder | What it is | Stack |
|--------|-----------|-------|
| [`contracts/`](contracts) | On-chain layer: treasury vault, payment streaming, ZK proof registry | Rust, Soroban SDK |
| [`backend/`](backend) | REST API: reads contract state, indexes events, stores campaign metadata, anchors proofs | Node 20, Express, TypeScript, SQLite |
| [`proof-server/`](proof-server) | Generates and locally verifies UltraHonk proofs for the payroll/budget compliance circuit | Node 22, Noir, Barretenberg |

Each folder is self-contained, with its own README, dependencies and tests.

## How it fits together

```
                ┌──────────────────────┐
  client ─────► │  backend   :4000     │ ── reads (simulation) ──┐
                │  Express API         │                         ▼
                └─────────┬────────────┘           ┌──────────────────────────┐
                          │ POST /api/prove        │  contracts (Soroban)     │
                          ▼                        │  • treasury_vault        │
                ┌──────────────────────┐           │  • streaming             │
                │  proof-server :4100  │           │  • proof_registry        │
                │  Noir circuit + bb   │           └──────────────────────────┘
                └─────────┬────────────┘                         ▲
                          │ verified proof hash                  │
                          └──── backend signs register_proof() ──┘
```

1. The admin publishes a recipient allowlist (as a Merkle root) and a commitment to the budget cap.
2. For each payment, the **proof server** proves the recipient is on the list and the amount is under
   the cap, then verifies the proof locally with `bb verify`.
3. The **backend** anchors the proof hash on-chain via `proof_registry::register_proof()`.
4. The **contracts** hold the funds, run payment streams, and keep the public proof record.

## Live testnet deployment

| Contract | ID |
|----------|----|
| `treasury_vault` | [`CAUWJPC73YLQMSV6X4QPLUVS2UZFE2PMRIQSSCDN62DNN6J76Y5RETIG`](https://stellar.expert/explorer/testnet/contract/CAUWJPC73YLQMSV6X4QPLUVS2UZFE2PMRIQSSCDN62DNN6J76Y5RETIG) |
| `streaming` | [`CDU7ZIVQ3UC4K3DHV3NMQGW5UMSYFCKCC6YJKHT4YLNEZJRWL6THE6WQ`](https://stellar.expert/explorer/testnet/contract/CDU7ZIVQ3UC4K3DHV3NMQGW5UMSYFCKCC6YJKHT4YLNEZJRWL6THE6WQ) |
| `proof_registry` | [`CBDLHQQPKC5524CFWPD4HMPTZGWBYQNW3IKGAFH6IAYBU3F2F6AO2332`](https://stellar.expert/explorer/testnet/contract/CBDLHQQPKC5524CFWPD4HMPTZGWBYQNW3IKGAFH6IAYBU3F2F6AO2332) |

## Quick start

Prerequisites: Node 20+ (22 for the proof server), Rust with the `wasm32-unknown-unknown` target, and for
proofs the pinned `nargo` and `bb` toolchains (see [`proof-server/README.md`](proof-server/README.md#toolchain),
or use its Docker image).

```bash
git clone https://github.com/ndii-dev/Veil.git
cd Veil

# Contracts: test and build
cd contracts && cargo test --workspace && cargo build --target wasm32-unknown-unknown --release && cd ..

# Proof server (http://localhost:4100)
cd proof-server && npm ci
export PROVE_API_KEYS="$(openssl rand -hex 32)"
npm start &
cd ..

# Backend (http://localhost:4000), testnet contract IDs are pre-filled
cd backend && npm ci && cp .env.example .env && npm run dev
```

Point the backend at the proof server with `PROOF_SERVER_URL` in `backend/.env` (default `http://localhost:4100`).

## Development

| Task | Contracts | Backend | Proof server |
|------|-----------|---------|--------------|
| Install | — | `npm ci` | `npm ci` |
| Test | `cargo test --workspace` | `npm test` | `npm test` |
| Lint | `cargo clippy` | `npm run lint` | `npm run lint` |
| Build | `cargo build --target wasm32-unknown-unknown --release` | `npm run build` | — |

CI runs per folder: a change under `backend/` only runs the backend workflow, and so on.
Dependabot keeps npm, Cargo, Docker and GitHub Actions dependencies current for each package.

## Security

Never commit secret keys or `.env` files. To report a vulnerability, see
[`SECURITY.md`](SECURITY.md).

## License

[MIT](LICENSE)
