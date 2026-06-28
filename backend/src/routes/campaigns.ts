import { Router } from 'express';
import { campaignDb } from '../services/db.js';
import type { Campaign } from '../types/index.js';

export const campaignsRouter = Router();

// GET /api/campaigns
campaignsRouter.get('/', (_req, res, next) => {
  try {
    const campaigns = campaignDb.findAll();
    res.json({ campaigns });
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id
campaignsRouter.get('/:id', (req, res, next) => {
  try {
    const campaign = campaignDb.findById(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: `Campaign ${req.params.id} not found` });
      return;
    }
    res.json({ campaign });
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns — called by the frontend after a successful on-chain launch
campaignsRouter.post('/', (req, res, next) => {
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

    campaignDb.upsert(campaign);
    res.status(201).json({ id: campaign.id, status: 'created' });
  } catch (err) {
    next(err);
  }
});
