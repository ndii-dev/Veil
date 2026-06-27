import { Router } from 'express';
import { config } from '../config/index.js';
import { getAllProofs, proofExists } from '../services/stellar.js';

export const proofsRouter = Router();

// GET /api/proofs
proofsRouter.get('/', async (_req, res, next) => {
  try {
    if (!config.contracts.proofRegistry) {
      res.status(503).json({ error: 'PROOF_REGISTRY_CONTRACT_ID not configured' });
      return;
    }
    const proofs = await getAllProofs(config.contracts.proofRegistry);
    res.json({ proofs });
  } catch (err) {
    next(err);
  }
});

// GET /api/proofs/:proofId
proofsRouter.get('/:proofId', async (req, res, next) => {
  try {
    if (!config.contracts.proofRegistry) {
      res.status(503).json({ error: 'PROOF_REGISTRY_CONTRACT_ID not configured' });
      return;
    }
    const { proofId } = req.params;
    const proofs = await getAllProofs(config.contracts.proofRegistry);
    const proof = proofs.find(p => p.id === Number(proofId));

    if (!proof) {
      res.status(404).json({ error: `Proof ${proofId} not found` });
      return;
    }
    res.json({ proof });
  } catch (err) {
    next(err);
  }
});

// POST /api/proofs/verify — off-chain ZK proof pre-verification before submitting on-chain
proofsRouter.post('/verify', async (req, res, next) => {
  try {
    const { proof, publicInputs } = req.body as { proof?: string; publicInputs?: string[] };

    if (!proof || !Array.isArray(publicInputs) || publicInputs.length === 0) {
      res.status(400).json({ error: 'proof (string) and publicInputs (string[]) are required' });
      return;
    }

    // Check if this proof hash is already registered on-chain
    if (config.contracts.proofRegistry) {
      const alreadyExists = await proofExists(config.contracts.proofRegistry, proof);
      if (alreadyExists) {
        res.status(409).json({ error: 'This proof hash is already registered on-chain' });
        return;
      }
    }

    // TODO: run Noir verifier circuit against proof + publicInputs
    // e.g. import { verify } from '@noir-lang/backend_barretenberg';
    res.json({ valid: false, message: 'Verifier not yet wired up — register proof on-chain directly' });
  } catch (err) {
    next(err);
  }
});
