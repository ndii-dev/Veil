import { Router } from 'express';

export const treasuryRouter = Router();

// GET /api/treasury/:contractId/balance
treasuryRouter.get('/:contractId/balance', async (req, res, next) => {
  try {
    const { contractId } = req.params;
    // TODO: invoke treasury_vault contract read via Stellar RPC
    res.json({ contractId, balance: '0', asset: 'XLM' });
  } catch (err) {
    next(err);
  }
});

// GET /api/treasury/:contractId/transactions
treasuryRouter.get('/:contractId/transactions', async (req, res, next) => {
  try {
    const { contractId } = req.params;
    const { limit = 20, cursor } = req.query;
    // TODO: query Horizon for contract ledger entries
    res.json({ contractId, transactions: [], limit, cursor: cursor ?? null });
  } catch (err) {
    next(err);
  }
});
