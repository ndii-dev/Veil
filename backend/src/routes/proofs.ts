import { Router } from 'express';
import { config } from '../config/index.js';
import { requireAdmin } from '../middleware/auth.js';
import { parse } from '../middleware/validate.js';
import { proveWithProofServer } from '../services/proofServer.js';
import { getProof, getProofs, proofExists, registerProof } from '../services/stellar.js';
import { anchorProofBody, pageQuery, proofIdParam } from './schemas.js';

export const proofsRouter = Router();

// GET /api/proofs?start=0&limit=50
proofsRouter.get('/', async (req, res, next) => {
  try {
    const { start, limit } = parse(pageQuery, req.query);
    if (!config.contracts.proofRegistry) {
      res.status(503).json({ error: 'PROOF_REGISTRY_CONTRACT_ID not configured' });
      return;
    }
    const { items, total } = await getProofs(config.contracts.proofRegistry, start, limit);
    res.json({ proofs: items, total, start, limit });
  } catch (err) {
    next(err);
  }
});

// GET /api/proofs/:proofId
proofsRouter.get('/:proofId', async (req, res, next) => {
  try {
    const { proofId } = parse(proofIdParam, req.params);
    if (!config.contracts.proofRegistry) {
      res.status(503).json({ error: 'PROOF_REGISTRY_CONTRACT_ID not configured' });
      return;
    }
    const proof = await getProof(config.contracts.proofRegistry, proofId);

    if (!proof) {
      res.status(404).json({ error: `Proof ${proofId} not found` });
      return;
    }
    res.json({ proof });
  } catch (err) {
    next(err);
  }
});

// POST /api/proofs — admin-only. Generates a proof on the proof server (which
// `bb verify`s it before returning), then anchors its hash on-chain via
// register_proof() signed by the backend's submitter key. The caller supplies
// circuit inputs only — a proof hash is never accepted from the client.
proofsRouter.post('/', requireAdmin, async (req, res, next) => {
  try {
    const input = parse(anchorProofBody, req.body);
    const registry = config.contracts.proofRegistry;
    if (!registry) {
      res.status(503).json({ error: 'PROOF_REGISTRY_CONTRACT_ID not configured' });
      return;
    }

    const proof = await proveWithProofServer(input);

    if (await proofExists(registry, proof.proofHash)) {
      res.status(409).json({ error: 'This proof hash is already registered on-chain', proofHash: proof.proofHash });
      return;
    }

    const { proofId, txHash } = await registerProof(
      registry,
      proof.proofHash,
      proof.publicInputsHash,
      proof.proofType,
    );

    res.status(201).json({
      proofId,
      txHash,
      proofType: proof.proofType,
      proofHash: proof.proofHash,
      publicInputsHash: proof.publicInputsHash,
      publicInputs: proof.publicInputs,
      merkleRoot: proof.merkleRoot,
      budgetCommitment: proof.budgetCommitment,
      // Needed to reproduce the same budget_commitment for later proofs.
      budgetSalt: proof.budgetSalt,
    });
  } catch (err) {
    next(err);
  }
});
