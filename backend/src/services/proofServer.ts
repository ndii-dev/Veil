import { z } from 'zod';
import { config } from '../config/index.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { ProofType } from '../types/index.js';

export interface ProveRequest {
  recipientId: string;
  amount: string;
  proofType: ProofType;
  allowlist: string[];
  budgetCap: string;
  budgetSalt?: string;
}

const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

// shieldfund-proof-server only returns a proof after `bb verify` accepts it.
const proveResponseSchema = z.object({
  valid: z.literal(true),
  proofType: z.enum(['payroll', 'operational', 'relief']),
  proofHash: hex32,
  publicInputsHash: hex32,
  publicInputs: z.array(z.string()),
  merkleRoot: z.string(),
  budgetCommitment: z.string(),
  budgetSalt: z.string(),
  recipientId: z.string(),
  amount: z.string(),
});

export type ProveResponse = z.infer<typeof proveResponseSchema>;

export async function proveWithProofServer(req: ProveRequest): Promise<ProveResponse> {
  let res: Response;
  try {
    res = await fetch(new URL('/api/prove', config.proofs.serverUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(config.proofs.serverTimeoutMs),
    });
  } catch (err) {
    throw new HttpError(502, `Proof server unreachable: ${(err as Error).message}`);
  }

  const body = await res.json().catch(() => ({})) as { error?: string };

  // 400 = the circuit rejected the inputs (not on allowlist, over budget, ...).
  if (res.status === 400) throw new HttpError(422, body.error ?? 'Proof generation rejected the inputs');
  if (!res.ok) throw new HttpError(502, `Proof server error (${res.status})`);

  const parsed = proveResponseSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(502, 'Proof server returned an unexpected response');
  if (parsed.data.proofType !== req.proofType) {
    throw new HttpError(502, 'Proof server returned a proof for a different proofType');
  }
  return parsed.data;
}
