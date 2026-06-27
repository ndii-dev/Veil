import { Router } from 'express';
import { config } from '../config/index.js';
import { getAllStreams, getStreamAccumulated } from '../services/stellar.js';

export const streamsRouter = Router();

// GET /api/streams
streamsRouter.get('/', async (_req, res, next) => {
  try {
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
    if (!config.contracts.streaming) {
      res.status(503).json({ error: 'STREAMING_CONTRACT_ID not configured' });
      return;
    }
    const { streamId } = req.params;
    const streams = await getAllStreams(config.contracts.streaming);
    const stream = streams.find(s => s.id === Number(streamId));

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
    if (!config.contracts.streaming) {
      res.status(503).json({ error: 'STREAMING_CONTRACT_ID not configured' });
      return;
    }
    const { streamId } = req.params;
    const claimable = await getStreamAccumulated(config.contracts.streaming, Number(streamId));
    res.json({ streamId, claimable, asset: 'USDC' });
  } catch (err) {
    next(err);
  }
});
