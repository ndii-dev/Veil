import { Router } from 'express';
import { config } from '../config/index.js';
import { getVaultBalance, getVaultStats, getContractEvents } from '../services/stellar.js';

export const treasuryRouter = Router();

// GET /api/treasury/:contractId/balance
treasuryRouter.get('/:contractId/balance', async (req, res, next) => {
  try {
    const contractId = req.params.contractId === 'default'
      ? config.contracts.treasuryVault
      : req.params.contractId;

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
    const contractId = req.params.contractId === 'default'
      ? config.contracts.treasuryVault
      : req.params.contractId;

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
    const contractId = req.params.contractId === 'default'
      ? config.contracts.treasuryVault
      : req.params.contractId;

    if (!contractId) {
      res.status(400).json({ error: 'No TREASURY_VAULT_CONTRACT_ID configured.' });
      return;
    }

    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const transactions = await getContractEvents(contractId, limit, cursor);
    res.json({ contractId, transactions, limit, cursor: cursor ?? null });
  } catch (err) {
    next(err);
  }
});
