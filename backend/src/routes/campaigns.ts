import { Router } from 'express';

export const campaignsRouter = Router();

// GET /api/campaigns — list all campaigns from contract state
campaignsRouter.get('/', async (_req, res, next) => {
  try {
    // TODO: read campaign list from treasury_vault contract
    res.json({ campaigns: [] });
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id
campaignsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    // TODO: fetch campaign by id from contract + IPFS metadata
    res.json({ id, campaign: null });
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns — cache newly launched campaign metadata
campaignsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as { id: string; title: string; goal: string; metadata?: object };
    // TODO: persist metadata to IPFS / database
    res.status(201).json({ id: body.id, status: 'created' });
  } catch (err) {
    next(err);
  }
});
