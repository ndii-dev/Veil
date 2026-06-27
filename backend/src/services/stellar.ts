import { SorobanRpc, Contract, nativeToScVal, scValToNative } from '@stellar/stellar-sdk';
import { config } from '../config/index.js';
import type { VaultStats, Stream, Proof } from '../types/index.js';

const server = new SorobanRpc.Server(config.stellar.rpcUrl);

async function simulateRead(contractId: string, method: string, args: unknown[] = []): Promise<unknown> {
  const contract = new Contract(contractId);
  const operation = contract.call(method, ...args.map(a => nativeToScVal(a)));

  // Build a minimal transaction for simulation (no source account needed for reads)
  const { StellarBase } = await import('@stellar/stellar-sdk');
  const account = new StellarBase.Account('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', '0');
  const tx = new StellarBase.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: config.stellar.network === 'mainnet'
      ? 'Public Global Stellar Network ; September 2015'
      : 'Test SDF Network ; September 2015',
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(result)) {
    throw new Error(`Simulation failed: ${result.error}`);
  }
  return scValToNative((result as SorobanRpc.Api.SimulateTransactionSuccessResponse).result!.retval);
}

export async function getVaultBalance(contractId: string): Promise<string> {
  const balance = await simulateRead(contractId, 'get_balance');
  return String(balance);
}

export async function getVaultStats(contractId: string): Promise<VaultStats> {
  const stats = await simulateRead(contractId, 'get_stats') as Record<string, bigint>;
  return {
    vaultBalance: String(stats.vault_balance),
    totalRaised: String(stats.total_raised),
    totalDisbursed: String(stats.total_disbursed),
  };
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
  const val = await simulateRead(contractId, 'get_accumulated', [streamId]);
  return String(val);
}

export async function getAllProofs(contractId: string): Promise<Proof[]> {
  const raw = await simulateRead(contractId, 'get_all_proofs') as Array<Record<string, unknown>>;
  return raw.map(p => ({
    id: Number(p.id),
    proofHash: String(p.proof_hash),
    publicInputsHash: String(p.public_inputs_hash),
    proofType: String(p.proof_type) as Proof['proofType'],
    timestamp: Number(p.timestamp),
    submitter: String(p.submitter),
  }));
}

export async function proofExists(contractId: string, proofHash: string): Promise<boolean> {
  const exists = await simulateRead(contractId, 'verify_proof_exists', [proofHash]);
  return Boolean(exists);
}
