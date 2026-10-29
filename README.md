<div align="center">

# Veil

**Private treasury management on Stellar, backed by zero-knowledge proofs.**

[![Contracts](https://github.com/ndii-dev/Veil/actions/workflows/contracts.yml/badge.svg)](https://github.com/ndii-dev/Veil/actions/workflows/contracts.yml)
[![Backend](https://github.com/ndii-dev/Veil/actions/workflows/backend.yml/badge.svg)](https://github.com/ndii-dev/Veil/actions/workflows/backend.yml)
[![Proof Server](https://github.com/ndii-dev/Veil/actions/workflows/proof-server.yml/badge.svg)](https://github.com/ndii-dev/Veil/actions/workflows/proof-server.yml)
![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue?logo=stellar)
![Soroban](https://img.shields.io/badge/Soroban-Rust-orange?logo=rust)
![Noir](https://img.shields.io/badge/ZK-Noir%20%2B%20UltraHonk-black)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## Overview

Organisations that run their money on a public blockchain face a trade-off: everything is transparent,
including things that shouldn't be. Who is on the payroll, how much each team's budget is, which
grantees were approved: all of it is visible to anyone reading the chain.

**Veil removes that trade-off.** Funds sit in an on-chain vault on Stellar, and every payout has to be
backed by a zero-knowledge proof that it follows the organisation's rules:

- the recipient is on the approved list, and
- the amount is within the budget the admin committed to in advance.

The proof shows the rules were followed **without revealing the rest of the list or the budget figure**.
Anyone can audit that every payment was compliant; nobody learns more than they need to.

### What you can do with it

| | |
|---|---|
| **Hold funds** | Accept deposits into a Soroban treasury vault and track total raised and disbursed. |
| **Pay out with proof** | Disburse only against a fresh, unspent proof made for exactly that recipient and amount. |
| **Stream payroll** | Pay people per second; recipients withdraw whenever they like, and admins can pause or close streams. |
| **Audit publicly** | Every proof is anchored on-chain in a registry anyone can query. |
| **Run campaigns** | Store campaign metadata (title, goal, details) off-chain behind a simple REST API. |

### Use cases

- **Payroll** for DAOs and remote teams, without exposing salaries or headcount.
- **Operational budgets**, proving each spend is within the approved cap.
- **Relief and grant distribution**, proving each beneficiary was approved without publishing the full list.

These three match the proof types the system supports: `payroll`, `operational` and `relief`.

---

## How it works

```
   Admin                                   Veil                                       Stellar
 ─────────                ─────────────────────────────────────────            ──────────────────
                           ┌─────────────────────┐
 allowlist + budget cap ──►│  backend  :4000     │
 recipient + amount        │  Express API        │
                           └──────────┬──────────┘
                                      │ 1. POST /api/prove
                                      ▼
                           ┌─────────────────────┐
                           │ proof-server :4100  │  2. Noir circuit proves:
                           │ Noir + Barretenberg │     • recipient ∈ allowlist (Merkle)
                           └──────────┬──────────┘     • amount ≤ committed budget cap
                                      │                3. bb verify checks the proof locally
                                      │ proof hash
                                      ▼
                           ┌─────────────────────┐   4. register_proof()   ┌──────────────────┐
                           │  backend            │ ──────────────────────► │ proof_registry   │
                           └─────────────────────┘                         └────────┬─────────┘
                                                                                     │
                                                      5. disburse(recipient,         ▼
                                                         amount, proof)    ┌──────────────────┐
                                                     ────────────────────► │ treasury_vault   │ ──► recipient
                                                                           └──────────────────┘
```

1. **Commit.** The admin publishes a Merkle root of approved recipients and a Pedersen commitment to
   the budget cap (`pedersen_hash(cap, salt)`). Only these two values are public.
2. **Prove.** For each payment, the proof server builds the Merkle tree, runs the `payroll_compliance`
   Noir circuit, and generates an UltraHonk proof with Barretenberg.
3. **Verify.** The proof server checks the proof with `bb verify` before it returns anything.
4. **Anchor.** The backend registers the proof hash on-chain in `proof_registry`.
5. **Pay.** `treasury_vault::disburse()` recomputes the expected hash for that exact recipient and
   amount, checks it is registered and unspent, marks it spent, and transfers the funds.

**What stays private:** the other entries on the allowlist and the exact budget cap.
**What is public:** the recipient and amount of each payment (they are already visible in the transfer
itself), the Merkle root, the budget commitment, and the proof record.

---

## Repository layout

```
Veil/
├── contracts/        Soroban smart contracts (Rust)
│   ├── treasury_vault/   custody: deposits, proof-gated disbursements, stats
│   ├── streaming/        per-second payment streams with funding reservations
│   └── proof_registry/   on-chain store of verified proof hashes
│
├── backend/          REST API (Node 20, Express, TypeScript, SQLite)
│   └── src/              contract reads, Horizon event indexing, campaigns, proof anchoring
│
├── proof-server/     ZK proof service (Node 22, Noir, Barretenberg)
│   ├── circuits/         payroll_compliance + hash_util Noir circuits
│   └── src/              prove + verify API, Merkle tree builder
│
└── .github/          per-package CI workflows, Dependabot, CODEOWNERS
```

Each package is self-contained, with its own README, dependencies and tests:

| Package | Docs | Highlights |
|---------|------|------------|
| **contracts** | [contracts/README.md](contracts/README.md) | Proof-gated payouts, double-spend protection, two-step admin transfer, paginated reads |
| **backend** | [backend/README.md](backend/README.md) | Simulation-based reads (no signing), event history, SQLite with online backups, admin API keys |
| **proof-server** | [proof-server/README.md](proof-server/README.md) | Real UltraHonk proofs, local verification, rate limits, pinned and checksum-verified toolchain, Docker image |

---

## Live testnet deployment

| Contract | Address |
|----------|---------|
| `treasury_vault` | [`CAUWJPC73YLQMSV6X4QPLUVS2UZFE2PMRIQSSCDN62DNN6J76Y5RETIG`](https://stellar.expert/explorer/testnet/contract/CAUWJPC73YLQMSV6X4QPLUVS2UZFE2PMRIQSSCDN62DNN6J76Y5RETIG) |
| `streaming` | [`CDU7ZIVQ3UC4K3DHV3NMQGW5UMSYFCKCC6YJKHT4YLNEZJRWL6THE6WQ`](https://stellar.expert/explorer/testnet/contract/CDU7ZIVQ3UC4K3DHV3NMQGW5UMSYFCKCC6YJKHT4YLNEZJRWL6THE6WQ) |
| `proof_registry` | [`CBDLHQQPKC5524CFWPD4HMPTZGWBYQNW3IKGAFH6IAYBU3F2F6AO2332`](https://stellar.expert/explorer/testnet/contract/CBDLHQQPKC5524CFWPD4HMPTZGWBYQNW3IKGAFH6IAYBU3F2F6AO2332) |

Amounts are in stroops (1 XLM = 10,000,000 stroops).

---

## API at a glance

The backend runs on `http://localhost:4000`. Full reference: [backend/README.md](backend/README.md#full-api-reference).

| Method | Path | What it does |
|--------|------|--------------|
| `GET` | `/health` | Server status and active network |
| `GET` | `/api/treasury/:contractId/stats` | Vault balance, total raised, total disbursed |
| `GET` | `/api/treasury/:contractId/transactions` | Paginated on-chain event history |
| `GET` | `/api/streams` · `/api/streams/:id/claimable` | Payment streams and live claimable amounts |
| `GET` | `/api/proofs` · `/api/proofs/:id` | Registered proofs |
| `POST` | `/api/proofs` | **Admin.** Generate a proof and anchor it on-chain |
| `GET` `POST` | `/api/campaigns` | Campaign metadata (create is admin-only) |

---

## Getting started

### Prerequisites

| Tool | Version | Needed for |
|------|---------|-----------|
| Node.js | 20+ (22 for the proof server) | backend, proof-server |
| Rust + `wasm32-unknown-unknown` | stable | contracts |
| `nargo` (Noir) | `1.0.0-beta.22` | proof-server |
| `bb` (Barretenberg) | `5.0.0-nightly.20260522` | proof-server |

The proof server's [Docker image](proof-server/README.md#docker) bundles `nargo` and `bb`, and its README
has [pinned, checksum-verified install steps](proof-server/README.md#toolchain).

### Run it locally

```bash
git clone https://github.com/ndii-dev/Veil.git
cd Veil

# 1. Contracts: run the tests and build the WASM
cd contracts
cargo test --workspace
cargo build --target wasm32-unknown-unknown --release
cd ..

# 2. Proof server → http://localhost:4100
cd proof-server
npm ci
export PROVE_API_KEYS="$(openssl rand -hex 32)"
npm start &
cd ..

# 3. Backend → http://localhost:4000 (testnet contract IDs are pre-filled)
cd backend
npm ci
cp .env.example .env
npm run dev
```

Then try it:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/treasury/default/stats
```

---

## Development

| Task | contracts | backend | proof-server |
|------|-----------|---------|--------------|
| Install | — | `npm ci` | `npm ci` |
| Test | `cargo test --workspace` | `npm test` | `npm test` |
| Lint | `cargo clippy` | `npm run lint` | `npm run lint` |
| Build | `cargo build --target wasm32-unknown-unknown --release` | `npm run build` | — |

- **CI runs per package.** A change under `backend/` runs only the backend workflow, and so on.
- **Dependabot** keeps npm, Cargo, Docker and GitHub Actions dependencies up to date for each package.
- **Guard scripts** in `proof-server/scripts/` reject obfuscated code and whitespace-padded lines in CI.

## Tech stack

**On-chain:** Stellar · Soroban · Rust
**Zero-knowledge:** Noir · Barretenberg (UltraHonk) · Pedersen hashing · Merkle proofs
**Off-chain:** Node.js · Express · TypeScript · SQLite · Horizon / Soroban RPC
**Ops:** GitHub Actions · Docker · Dependabot · Railway

---

## Trust model and limitations

Veil is a working reference implementation running on **testnet**, not audited production software.

- **Proofs are verified off-chain.** Soroban has no native verifier for Noir proofs yet, so the proof
  server verifies each proof and the contract anchors its hash. The chain trusts the address allowed to
  call `register_proof()`. Closing that gap needs an on-chain verifier or a multi-party attestation scheme.
- **Allowlists hold up to 16 recipients** (Merkle depth 4). The depth can be raised in the circuit and the
  proof server config together.
- **Recipient ID `0` is reserved** as padding for empty allowlist slots.

See each package's README for the full list.

## Security

Please don't open public issues for vulnerabilities. Report them privately as described in
[SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
