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

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', network: config.stellar.network });
});

app.use('/api/treasury', treasuryRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/proofs', proofsRouter);
app.use('/api/streams', streamsRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`ShieldFund API running on http://localhost:${config.port} [${config.stellar.network}]`);
});
