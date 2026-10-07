import { StrKey } from '@stellar/stellar-sdk';
import { z } from 'zod';

export const contractIdParam = z.object({
  contractId: z.union([
    z.literal('default'),
    z.string().refine(s => StrKey.isValidContract(s), 'must be a Stellar contract id (C...)'),
  ]),
});

const u32 = z.coerce.number().int().min(0).max(0xffffffff);

export const streamIdParam = z.object({ streamId: u32 });
export const proofIdParam = z.object({ proofId: u32 });
export const campaignIdParam = z.object({ id: z.string().min(1).max(128) });

// ?start=&limit= for list endpoints backed by paginated contract reads.
export const pageQuery = z.object({
  start: z.coerce.number().int().min(0).max(0xffffffff).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export const transactionsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(256).optional(),
});

export const campaignBody = z.object({
  id: z.string().min(1).max(128).regex(/^[\w-]+$/, 'letters, digits, _ and - only'),
  title: z.string().trim().min(1).max(200),
  goal: z.string().regex(/^\d{1,39}$/, 'integer amount in stroops'),
  metadata: z.record(z.string(), z.unknown()).optional()
    .refine(m => m === undefined || JSON.stringify(m).length <= 10_000, 'metadata too large'),
}).strict();

// A Noir Field value: decimal or 0x-prefixed hex.
const field = z.string().regex(/^(\d{1,78}|0x[0-9a-fA-F]{1,64})$/, 'decimal or 0x-hex field value');

export const anchorProofBody = z.object({
  recipientId: field,
  amount: field,
  proofType: z.enum(['payroll', 'operational', 'relief']),
  allowlist: z.array(field).min(1).max(16),
  budgetCap: field,
  budgetSalt: field.optional(),
}).strict();
