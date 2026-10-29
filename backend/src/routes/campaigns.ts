import { Router } from 'express';
import { campaignDb } from '../services/db.js';
import { requireAdmin } from '../middleware/auth.js';
import { parse } from '../middleware/validate.js';
import { campaignBody, campaignIdParam, pageQuery } from './schemas.js';

export const campaignsRouter = Router();

// GET /api/campaigns?start=0&limit=50 (newest first)
campaignsRouter.get('/', (req, res, next) => {
  try {
    const { start, limit } = parse(pageQuery, req.query);
    const { items, total } = campaignDb.findPage(start, limit);
    res.json({ campaigns: items, total, start, limit });
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
