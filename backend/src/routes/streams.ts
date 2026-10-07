import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config/index.js';
import { parse } from '../middleware/validate.js';
import { getAllStreams, getStreamAccumulated } from '../services/stellar.js';
import { streamIdParam } from './schemas.js';

export const streamsRouter = Router();

// GET /api/streams
streamsRouter.get('/', async (req, res, next) => {
  try {
    parse(z.object({}).strict(), req.query);
    if (!config.contracts.streaming) {
      res.status(503).json({ error: 'STREAMING_CONTRACT_ID not configured' });
      return;
    }
    const streams = await getAllStreams(config.contracts.streaming);
    res.json({ streams });
  } catch (err) {
    next(err);
  }
});

// GET /api/streams/:streamId
streamsRouter.get('/:streamId', async (req, res, next) => {
  try {
    const { streamId } = parse(streamIdParam, req.params);
    if (!config.contracts.streaming) {
      res.status(503).json({ error: 'STREAMING_CONTRACT_ID not configured' });
      return;
    }
    const streams = await getAllStreams(config.contracts.streaming);
    const stream = streams.find(s => s.id === streamId);

    if (!stream) {
      res.status(404).json({ error: `Stream ${streamId} not found` });
      return;
    }
    res.json({ stream });
  } catch (err) {
    next(err);
  }
});

// GET /api/streams/:streamId/claimable
streamsRouter.get('/:streamId/claimable', async (req, res, next) => {
  try {
    const { streamId } = parse(streamIdParam, req.params);
    if (!config.contracts.streaming) {
      res.status(503).json({ error: 'STREAMING_CONTRACT_ID not configured' });
      return;
    }
    const claimable = await getStreamAccumulated(config.contracts.streaming, streamId);
    res.json({ streamId, claimable, asset: 'USDC' });
  } catch (err) {
    next(err);
  }
});
