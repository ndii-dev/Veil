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
import { HttpError } from '../middleware/errorHandler.js';
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

// ── Paginated reads ───────────────────────────────────────────────────────────
// Current contracts expose get_*_count + get_*(start, limit) + get_proof/
// get_stream(id) with typed errors. The contracts still deployed on testnet
// predate that, so each contract's capability is probed once and the old
// whole-vector getters are used only as a fallback.

/** Largest page the contracts return per call (MAX_PAGE_SIZE). */
export const CONTRACT_PAGE_SIZE = 50;

export interface Page<T> {
  items: T[];
  total: number;
}

const paginatedSupport = new Map<string, boolean>();

const isMissingFunction = (err: unknown) => /Error\(WasmVm, MissingValue\)/.test(String((err as Error)?.message ?? err));
const isContractError = (err: unknown, code: number) =>
  String((err as Error)?.message ?? err).includes(`Error(Contract, #${code})`);

/** Returns the item count, or null if this contract predates pagination. */
async function countOrLegacy(contractId: string, countMethod: string): Promise<number | null> {
  if (paginatedSupport.get(contractId) === false) return null;
  try {
    const count = Number(await simulateRead(contractId, countMethod));
    paginatedSupport.set(contractId, true);
    return count;
  } catch (err) {
    if (!isMissingFunction(err)) throw err;
    paginatedSupport.set(contractId, false);
    return null;
  }
}

async function readPage<T>(
  contractId: string,
  methods: { count: string; page: string; all: string },
  map: (raw: Record<string, unknown>) => T,
  start: number,
  limit: number,
): Promise<Page<T>> {
  const total = await countOrLegacy(contractId, methods.count);
  if (total === null) {
    const all = (await simulateRead(contractId, methods.all) as Array<Record<string, unknown>>).map(map);
    return { items: all.slice(start, start + limit), total: all.length };
  }
  if (start >= total) return { items: [], total };

  const items: T[] = [];
  for (let offset = start; offset < Math.min(start + limit, total); offset += CONTRACT_PAGE_SIZE) {
    const size = Math.min(CONTRACT_PAGE_SIZE, start + limit - offset);
    const raw = await simulateRead(contractId, methods.page, [
      xdr.ScVal.scvU32(offset),
      xdr.ScVal.scvU32(size),
    ]) as Array<Record<string, unknown>>;
    items.push(...raw.map(map));
  }
  return { items, total };
}

/** Reads one item by id; null when it doesn't exist. */
async function readOne<T>(
  contractId: string,
  methods: { count: string; one: string; all: string },
  notFoundCode: number,
  map: (raw: Record<string, unknown>) => T & { id: number },
  id: number,
): Promise<T | null> {
  const total = await countOrLegacy(contractId, methods.count);
  if (total === null) {
    // Legacy contracts trap with a generic error on a missing id, so scan.
    const all = (await simulateRead(contractId, methods.all) as Array<Record<string, unknown>>).map(map);
    return all.find(item => item.id === id) ?? null;
  }
  try {
    return map(await simulateRead(contractId, methods.one, [xdr.ScVal.scvU32(id)]) as Record<string, unknown>);
  } catch (err) {
    if (isContractError(err, notFoundCode)) return null;
    throw err;
  }
}

const STREAM_METHODS = { count: 'get_stream_count', page: 'get_streams', one: 'get_stream', all: 'get_all_streams' };
const PROOF_METHODS = { count: 'get_proof_count', page: 'get_proofs', one: 'get_proof', all: 'get_all_proofs' };
const STREAM_NOT_FOUND = 4; // streaming::Error::StreamNotFound
const PROOF_NOT_FOUND = 3;  // proof_registry::Error::ProofNotFound

function toStream(s: Record<string, unknown>): Stream {
  return {
    id: Number(s.id),
    recipient: String(s.recipient),
    flowRatePerSecond: String(s.flow_rate_per_second),
    startTime: Number(s.start_time),
    endTime: Number(s.end_time),
    accumulated: String(s.accumulated),
    lastUpdate: Number(s.last_update),
    status: String(s.status) as Stream['status'],
  };
}

export const getStreams = (contractId: string, start: number, limit: number) =>
  readPage(contractId, STREAM_METHODS, toStream, start, limit);

export const getStream = (contractId: string, streamId: number) =>
  readOne(contractId, STREAM_METHODS, STREAM_NOT_FOUND, toStream, streamId);

export async function getStreamAccumulated(contractId: string, streamId: number): Promise<string> {
  const args = [xdr.ScVal.scvU32(streamId)];
  const val = await simulateRead(contractId, 'get_accumulated', args);
  return String(val);
}

function toProof(p: Record<string, unknown>): Proof {
  return {
    id: Number(p.id),
    proofHash: Buffer.isBuffer(p.proof_hash) ? (p.proof_hash as Buffer).toString('hex') : String(p.proof_hash),
    publicInputsHash: Buffer.isBuffer(p.public_inputs_hash) ? (p.public_inputs_hash as Buffer).toString('hex') : String(p.public_inputs_hash),
    proofType: String(p.proof_type) as Proof['proofType'],
    timestamp: Number(p.timestamp),
    submitter: String(p.submitter),
  };
}

export const getProofs = (contractId: string, start: number, limit: number) =>
  readPage(contractId, PROOF_METHODS, toProof, start, limit);

export const getProof = (contractId: string, proofId: number) =>
  readOne(contractId, PROOF_METHODS, PROOF_NOT_FOUND, toProof, proofId);

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

// One submitter account means one sequence number: concurrent submissions
// would all build on the same sequence and all but one would be rejected
// (txBadSeq). Run them one at a time. This only covers a single backend
// process — multiple replicas need separate submitter keys or a shared queue.
let submissionQueue: Promise<unknown> = Promise.resolve();

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = submissionQueue.then(task, task);
  submissionQueue = run.catch(() => undefined);
  return run;
}

// proof_registry::Error codes (see shieldfund-contracts README → Errors).
const REGISTRY_NOT_ADMIN = 1;
const REGISTRY_ALREADY_REGISTERED = 2;

/**
 * Signs and submits proof_registry::register_proof() from the backend's
 * dedicated submitter key, waits for the result, and returns the proof id.
 * Submissions are serialized so they never race on the account sequence.
 */
export function registerProof(
  contractId: string,
  proofHash: string,
  publicInputsHash: string,
  proofType: ProofType,
): Promise<{ proofId: number; txHash: string }> {
  return serialized(() => submitRegisterProof(contractId, proofHash, publicInputsHash, proofType));
}

async function submitRegisterProof(
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

  // Simulates, attaches the auth entry and resource footprint/fee. Typed
  // contract errors surface here, before anything is submitted.
  let prepared: Awaited<ReturnType<typeof server.prepareTransaction>>;
  try {
    prepared = await server.prepareTransaction(tx);
  } catch (err) {
    const message = String((err as Error)?.message ?? err);
    if (message.includes(`Error(Contract, #${REGISTRY_ALREADY_REGISTERED})`)) {
      throw new HttpError(409, 'This proof hash is already registered on-chain');
    }
    if (message.includes(`Error(Contract, #${REGISTRY_NOT_ADMIN})`)) {
      throw new HttpError(503, 'Submitter key is not the proof_registry admin');
    }
    throw err;
  }
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
