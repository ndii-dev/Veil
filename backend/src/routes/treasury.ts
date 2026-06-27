import { Router } from 'express';
import { config } from '../config/index.js';
import { getVaultBalance, getVaultStats } from '../services/stellar.js';

export const treasuryRouter = Router();

// GET /api/treasury/:contractId/balance
treasuryRouter.get('/:contractId/balance', async (req, res, next) => {
  try {
    const { contractId } = req.params;
    const contractToUse = contractId === 'default' ? config.contracts.treasuryVault : contractId;

    if (!contractToUse) {
      res.status(400).json({ error: 'No treasury vault contract ID configured. Set TREASURY_VAULT_CONTRACT_ID in .env' });
      return;
    }

    const balance = await getVaultBalance(contractToUse);
    res.json({ contractId: contractToUse, balance, asset: 'USDC' });
  } catch (err) {
    next(err);
  }
});

// GET /api/treasury/:contractId/stats
treasuryRouter.get('/:contractId/stats', async (req, res, next) => {
  try {
    const { contractId } = req.params;
    const contractToUse = contractId === 'default' ? config.contracts.treasuryVault : contractId;

    if (!contractToUse) {
      res.status(400).json({ error: 'No treasury vault contract ID configured.' });
      return;
    }

    const stats = await getVaultStats(contractToUse);
    res.json({ contractId: contractToUse, ...stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/treasury/:contractId/transactions
treasuryRouter.get('/:contractId/transactions', async (req, res, next) => {
  try {
    const { contractId } = req.params;
    const { limit = 20, cursor } = req.query;
    // Horizon event indexing — wire up with server.getContractEvents() from stellar-sdk
    res.json({ contractId, transactions: [], limit: Number(limit), cursor: cursor ?? null });
  } catch (err) {
    next(err);
  }
});
