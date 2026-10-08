import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config } from './config/index.js';
import { treasuryRouter } from './routes/treasury.js';
import { campaignsRouter } from './routes/campaigns.js';
import { proofsRouter } from './routes/proofs.js';
import { streamsRouter } from './routes/streams.js';
import { errorHandler } from './middleware/errorHandler.js';
import { writeLimiter } from './middleware/rateLimit.js';

// The Express app, without listening — imported by src/index.ts and the tests.
export const app = express();

if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);

app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '100kb' }));
app.use(writeLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', network: config.stellar.network });
});

app.use('/api/treasury', treasuryRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/proofs', proofsRouter);
app.use('/api/streams', streamsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);
