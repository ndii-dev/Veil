import 'dotenv/config';
import { app } from './app.js';
import { config } from './config/index.js';
import { startBackupSchedule } from './services/backup.js';
import { checkSubmitterIsRegistryAdmin } from './services/stellar.js';

app.listen(config.port, () => {
  console.log(`ShieldFund API running on http://localhost:${config.port} [${config.stellar.network}]`);
  startBackupSchedule();
  checkSubmitterIsRegistryAdmin().catch(err => {
    console.warn(`Could not check proof submitter against registry admin: ${(err as Error).message}`);
  });
});
