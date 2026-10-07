import {
  rpc,
  Address,
  Contract,
  TransactionBuilder,
  Account,
  Keypair,
  Networks,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { config } from '../config/index.js';
import type { VaultStats, Stream, Proof, ProofType } from '../types/index.js';

// Source account for read-only simulations. Simulation doesn't require the
// account to exist or sign, so the all-zero ed25519 key is used.
const SIMULATION_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

// RPC only retains ~7 days of events (~120,960 ledgers); stay inside that window.
const EVENT_RETENTION_LEDGERS = 120_000;

const server = new rpc.Server(config.stellar.rpcUrl, { allowHttp: false });

const networkPassphrase =
  config.stellar.network === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

async function simulateRead(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<unknown> {
  const contract = new Contract(contractId);
  const account = new Account(SIMULATION_SOURCE, '0');

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(result)) {
    throw new Error(`Contract simulation failed [${contractId}::${method}]: ${result.error}`);
  }
  if (!result.result) {
    throw new Error(`No return value from ${contractId}::${method}`);
  }

  return scValToNative(result.result.retval);
}

const hexToBytes32 = (hex: string) => Buffer.from(hex.replace(/^0x/, ''), 'hex');

export async function getVaultBalance(contractId: string): Promise<string> {
  const balance = await simulateRead(contractId, 'get_balance');
  return String(balance);
}

export async function getVaultStats(contractId: string): Promise<VaultStats> {
  const stats = await simulateRead(contractId, 'get_stats') as Record<string, bigint>;
  return {
    vaultBalance: String(stats.vault_balance ?? 0n),
    totalRaised: String(stats.total_raised ?? 0n),
    totalDisbursed: String(stats.total_disbursed ?? 0n),
  };
}

export async function getContractEvents(contractId: string, limit: number, cursor?: string) {
  const filters: rpc.Api.EventFilter[] = [
    { type: 'contract', contractIds: [contractId] },
  ];

  let response: rpc.Api.GetEventsResponse;
  if (cursor) {
    response = await server.getEvents({ filters, limit, cursor });
  } else {
    const { sequence } = await server.getLatestLedger();
    const startLedger = Math.max(1, sequence - EVENT_RETENTION_LEDGERS);
    response = await server.getEvents({ filters, limit, startLedger });
  }

  return response.events.map(e => ({
    id: e.id,
    type: e.type,
    ledger: e.ledger,
    timestamp: e.ledgerClosedAt,
    topic: e.topic.map(t => scValToNative(t)),
    value: scValToNative(e.value),
  }));
}

export async function getAllStreams(contractId: string): Promise<Stream[]> {
  const raw = await simulateRead(contractId, 'get_all_streams') as Array<Record<string, unknown>>;
  return raw.map(s => ({
    id: Number(s.id),
    recipient: String(s.recipient),
    flowRatePerSecond: String(s.flow_rate_per_second),
    startTime: Number(s.start_time),
    endTime: Number(s.end_time),
    accumulated: String(s.accumulated),
    lastUpdate: Number(s.last_update),
    status: String(s.status) as Stream['status'],
  }));
}

export async function getStreamAccumulated(contractId: string, streamId: number): Promise<string> {
  const args = [xdr.ScVal.scvU32(streamId)];
  const val = await simulateRead(contractId, 'get_accumulated', args);
  return String(val);
}

export async function getAllProofs(contractId: string): Promise<Proof[]> {
  const raw = await simulateRead(contractId, 'get_all_proofs') as Array<Record<string, unknown>>;
  return raw.map(p => ({
    id: Number(p.id),
    proofHash: Buffer.isBuffer(p.proof_hash) ? (p.proof_hash as Buffer).toString('hex') : String(p.proof_hash),
    publicInputsHash: Buffer.isBuffer(p.public_inputs_hash) ? (p.public_inputs_hash as Buffer).toString('hex') : String(p.public_inputs_hash),
    proofType: String(p.proof_type) as Proof['proofType'],
    timestamp: Number(p.timestamp),
    submitter: String(p.submitter),
  }));
}

export async function proofExists(contractId: string, proofHash: string): Promise<boolean> {
  const args = [xdr.ScVal.scvBytes(hexToBytes32(proofHash))];
  const exists = await simulateRead(contractId, 'verify_proof_exists', args);
  return Boolean(exists);
}

// ── Proof submission ──────────────────────────────────────────────────────────

function submitterKeypair(): Keypair {
  if (!config.proofs.submitterSecret) {
    throw Object.assign(new Error('PROOF_SUBMITTER_SECRET not configured'), { status: 503 });
  }
  return Keypair.fromSecret(config.proofs.submitterSecret);
}

/**
 * Signs and submits proof_registry::register_proof() from the backend's
 * dedicated submitter key, waits for the result, and returns the proof id.
 */
export async function registerProof(
  contractId: string,
  proofHash: string,
  publicInputsHash: string,
  proofType: ProofType,
): Promise<{ proofId: number; txHash: string }> {
  const keypair = submitterKeypair();
  const account = await server.getAccount(keypair.publicKey());
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
    .addOperation(contract.call(
      'register_proof',
      new Address(keypair.publicKey()).toScVal(),
      xdr.ScVal.scvBytes(hexToBytes32(proofHash)),
      xdr.ScVal.scvBytes(hexToBytes32(publicInputsHash)),
      nativeToScVal(proofType, { type: 'symbol' }),
    ))
    .setTimeout(60)
    .build();

  // Simulates, attaches the auth entry and resource footprint/fee.
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(keypair);

  const sent = await server.sendTransaction(prepared);
  if (sent.status !== 'PENDING' && sent.status !== 'DUPLICATE') {
    throw new Error(`register_proof submission rejected: ${sent.status}`);
  }

  const final = await server.pollTransaction(sent.hash, {
    attempts: 30,
    sleepStrategy: rpc.LinearSleepStrategy,
  });
  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`register_proof transaction ${sent.hash} did not succeed: ${final.status}`);
  }

  return {
    proofId: Number(final.returnValue ? scValToNative(final.returnValue) : NaN),
    txHash: sent.hash,
  };
}

/** Warns at startup if the submitter key can't actually register proofs. */
export async function checkSubmitterIsRegistryAdmin(): Promise<void> {
  if (!config.proofs.submitterSecret || !config.contracts.proofRegistry) return;
  const submitter = submitterKeypair().publicKey();
  const admin = String(await simulateRead(config.contracts.proofRegistry, 'get_admin'));
  if (admin !== submitter) {
    console.warn(
      `PROOF_SUBMITTER_SECRET (${submitter}) is not the proof_registry admin (${admin}); ` +
      'register_proof() will fail until admin is transferred to it.',
    );
  }
}
