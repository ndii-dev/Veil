import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config/index.js';
import { parse } from '../middleware/validate.js';
import { getVaultBalance, getVaultStats, getContractEvents } from '../services/stellar.js';
import { contractIdParam, transactionsQuery } from './schemas.js';

export const treasuryRouter = Router();

function resolveContractId(params: unknown): string {
  const { contractId } = parse(contractIdParam, params);
  return contractId === 'default' ? config.contracts.treasuryVault : contractId;
}

// GET /api/treasury/:contractId/balance
treasuryRouter.get('/:contractId/balance', async (req, res, next) => {
  try {
    const contractId = resolveContractId(req.params);
    parse(z.object({}).strict(), req.query);

    if (!contractId) {
      res.status(400).json({ error: 'No TREASURY_VAULT_CONTRACT_ID configured. Set it in .env' });
      return;
    }

    const balance = await getVaultBalance(contractId);
    res.json({ contractId, balance, asset: 'USDC' });
  } catch (err) {
    next(err);
  }
});

// GET /api/treasury/:contractId/stats
treasuryRouter.get('/:contractId/stats', async (req, res, next) => {
  try {
    const contractId = resolveContractId(req.params);
    parse(z.object({}).strict(), req.query);

    if (!contractId) {
      res.status(400).json({ error: 'No TREASURY_VAULT_CONTRACT_ID configured.' });
      return;
    }

    const stats = await getVaultStats(contractId);
    res.json({ contractId, ...stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/treasury/:contractId/transactions?limit=20&cursor=
treasuryRouter.get('/:contractId/transactions', async (req, res, next) => {
  try {
    const contractId = resolveContractId(req.params);
    const { limit, cursor } = parse(transactionsQuery, req.query);

    if (!contractId) {
      res.status(400).json({ error: 'No TREASURY_VAULT_CONTRACT_ID configured.' });
      return;
    }

    const transactions = await getContractEvents(contractId, limit, cursor);
    res.json({ contractId, transactions, limit, cursor: cursor ?? null });
  } catch (err) {
    next(err);
  }
});
