import 'dotenv/config';
import { app } from './app.js';
import { config } from './config/index.js';
import { startBackupSchedule } from './services/backup.js';
import { db } from './services/db.js';
import { checkSubmitterIsRegistryAdmin } from './services/stellar.js';

// How long in-flight requests (a proof can take a minute) get to finish.
const SHUTDOWN_TIMEOUT_MS = 90_000;

const server = app.listen(config.port, () => {
  console.log(`ShieldFund API running on http://localhost:${config.port} [${config.stellar.network}]`);
  startBackupSchedule();
  checkSubmitterIsRegistryAdmin().catch(err => {
    console.warn(`Could not check proof submitter against registry admin: ${(err as Error).message}`);
  });
});

// On SIGTERM (Railway redeploys) or Ctrl-C: stop accepting connections, let
// in-flight requests finish, then close SQLite so the WAL is checkpointed.
let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  const force = setTimeout(() => {
    console.error('Shutdown timed out with requests still in flight');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  force.unref();

  server.close(() => {
    db.close();
    clearTimeout(force);
    process.exit(0);
  });
  server.closeIdleConnections();
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => shutdown(signal));
