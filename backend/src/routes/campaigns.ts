import { Router } from 'express';
import { campaignDb } from '../services/db.js';
import { requireAdmin } from '../middleware/auth.js';
import { parse } from '../middleware/validate.js';
import { campaignBody, campaignIdParam } from './schemas.js';
import { z } from 'zod';

export const campaignsRouter = Router();

// GET /api/campaigns
campaignsRouter.get('/', (req, res, next) => {
  try {
    parse(z.object({}).strict(), req.query);
    const campaigns = campaignDb.findAll();
    res.json({ campaigns });
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id
campaignsRouter.get('/:id', (req, res, next) => {
  try {
    const { id } = parse(campaignIdParam, req.params);
    const campaign = campaignDb.findById(id);
    if (!campaign) {
      res.status(404).json({ error: `Campaign ${id} not found` });
      return;
    }
    res.json({ campaign });
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns — admin-only; records metadata after an on-chain launch.
// Existing campaigns are never overwritten (409).
campaignsRouter.post('/', requireAdmin, (req, res, next) => {
  try {
    const campaign = parse(campaignBody, req.body);
    if (!campaignDb.create(campaign)) {
      res.status(409).json({ error: `Campaign ${campaign.id} already exists` });
      return;
    }
    res.status(201).json({ id: campaign.id, status: 'created' });
  } catch (err) {
    next(err);
  }
});
