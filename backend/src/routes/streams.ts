import { Router } from 'express';

export const streamsRouter = Router();

// GET /api/streams — list active payment streams
streamsRouter.get('/', async (_req, res, next) => {
  try {
    // TODO: query streaming contract for all active streams
    res.json({ streams: [] });
  } catch (err) {
    next(err);
  }
});

// GET /api/streams/:streamId
streamsRouter.get('/:streamId', async (req, res, next) => {
  try {
    const { streamId } = req.params;
    // TODO: fetch stream by id from streaming contract
    res.json({ streamId, stream: null });
  } catch (err) {
    next(err);
  }
});

// GET /api/streams/:streamId/claimable — compute claimable amount at current ledger
streamsRouter.get('/:streamId/claimable', async (req, res, next) => {
  try {
    const { streamId } = req.params;
    // TODO: compute claimable = rate * (now - lastClaim)
    res.json({ streamId, claimable: '0', asset: 'XLM' });
  } catch (err) {
    next(err);
  }
});
