import { Router } from 'express';

export const proofsRouter = Router();

// GET /api/proofs — list verified proofs from proof_registry contract
proofsRouter.get('/', async (_req, res, next) => {
  try {
    // TODO: query proof_registry contract for all stored proofs
    res.json({ proofs: [] });
  } catch (err) {
    next(err);
  }
});

// GET /api/proofs/:proofId
proofsRouter.get('/:proofId', async (req, res, next) => {
  try {
    const { proofId } = req.params;
    // TODO: fetch proof by id from proof_registry contract
    res.json({ proofId, proof: null });
  } catch (err) {
    next(err);
  }
});

// POST /api/proofs/verify — off-chain ZK proof pre-verification before submitting on-chain
proofsRouter.post('/verify', async (req, res, next) => {
  try {
    const { proof, publicInputs } = req.body as { proof: string; publicInputs: string[] };
    if (!proof || !publicInputs) {
      res.status(400).json({ error: 'proof and publicInputs are required' });
      return;
    }
    // TODO: run verifier circuit against proof + publicInputs
    res.json({ valid: false, message: 'Verifier not yet wired up' });
  } catch (err) {
    next(err);
  }
});
