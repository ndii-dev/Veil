import { Router } from 'express';
import { config } from '../config/index.js';
import { parse } from '../middleware/validate.js';
import { getStream, getStreamAccumulated, getStreams } from '../services/stellar.js';
import { pageQuery, streamIdParam } from './schemas.js';

export const streamsRouter = Router();

// GET /api/streams?start=0&limit=50
streamsRouter.get('/', async (req, res, next) => {
  try {
    const { start, limit } = parse(pageQuery, req.query);
    if (!config.contracts.streaming) {
      res.status(503).json({ error: 'STREAMING_CONTRACT_ID not configured' });
      return;
    }
    const { items, total } = await getStreams(config.contracts.streaming, start, limit);
    res.json({ streams: items, total, start, limit });
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
    const stream = await getStream(config.contracts.streaming, streamId);

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
