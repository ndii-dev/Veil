import {
  SorobanRpc,
  Contract,
  TransactionBuilder,
  Account,
  Networks,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { config } from '../config/index.js';
import type { VaultStats, Stream, Proof } from '../types/index.js';

// A stable read-only public key used only for simulation (never signs anything)
const SIMULATION_SOURCE = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

const server = new SorobanRpc.Server(config.stellar.rpcUrl, { allowHttp: false });

const networkPassphrase =
  config.stellar.network === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

async function simulateRead(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<unknown> {
  const contract = new Contract(contractId);
  const account = new Account(SIMULATION_SOURCE, '0');

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(result)) {
    throw new Error(`Contract simulation failed [${contractId}::${method}]: ${result.error}`);
  }

  const successResult = result as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  if (!successResult.result) {
    throw new Error(`No return value from ${contractId}::${method}`);
  }

  return scValToNative(successResult.result.retval);
}

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
  const filters: SorobanRpc.Api.EventFilter[] = [
    { type: 'contract', contractIds: [contractId] },
  ];

  const response = await server.getEvents({
    startLedger: cursor ? undefined : 1,
    filters,
    limit,
    cursor,
  });

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
  const { xdr: XdrNs } = await import('@stellar/stellar-sdk');
  const args = [XdrNs.ScVal.scvU32(streamId)];
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
  const { xdr: XdrNs } = await import('@stellar/stellar-sdk');
  const hashBytes = Buffer.from(proofHash.replace(/^0x/, ''), 'hex');
  const args = [XdrNs.ScVal.scvBytes(hashBytes)];
  const exists = await simulateRead(contractId, 'verify_proof_exists', args);
  return Boolean(exists);
}
