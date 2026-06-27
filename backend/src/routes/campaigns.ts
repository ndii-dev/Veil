import { Router } from 'express';
import type { Campaign } from '../types/index.js';

export const campaignsRouter = Router();

// In-memory store for campaign metadata (replace with a database / IPFS in production)
const campaignStore = new Map<string, Campaign>();

// GET /api/campaigns
campaignsRouter.get('/', async (_req, res, next) => {
  try {
    const campaigns = Array.from(campaignStore.values());
    res.json({ campaigns });
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id
campaignsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const campaign = campaignStore.get(id);

    if (!campaign) {
      res.status(404).json({ error: `Campaign ${id} not found` });
      return;
    }
    res.json({ campaign });
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns — cache campaign metadata after launching on-chain
campaignsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as Partial<Campaign>;

    if (!body.id || !body.title || !body.goal) {
      res.status(400).json({ error: 'id, title, and goal are required' });
      return;
    }

    const campaign: Campaign = {
      id: body.id,
      title: body.title,
      goal: body.goal,
      metadata: body.metadata,
    };

    campaignStore.set(campaign.id, campaign);
    res.status(201).json({ id: campaign.id, status: 'created' });
  } catch (err) {
    next(err);
  }
});
