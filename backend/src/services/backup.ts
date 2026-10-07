import { mkdirSync, readdirSync, unlinkSync } from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { db } from './db.js';

const PREFIX = 'shieldfund-';

// Online snapshot via SQLite's backup API — safe while the server is writing.
export async function backupDatabase(destDir: string, keep = config.db.backupKeep): Promise<string> {
  mkdirSync(destDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(destDir, `${PREFIX}${stamp}.db`);
  await db.backup(dest);

  // Prune oldest snapshots beyond `keep` (ISO timestamps sort lexically).
  const snapshots = readdirSync(destDir)
    .filter(f => f.startsWith(PREFIX) && f.endsWith('.db'))
    .sort();
  for (const old of snapshots.slice(0, Math.max(0, snapshots.length - keep))) {
    unlinkSync(path.join(destDir, old));
  }
  return dest;
}

export function startBackupSchedule(): void {
  const { backupDir, backupIntervalMinutes } = config.db;
  if (!backupDir) {
    if (config.nodeEnv === 'production') {
      console.warn('DB_BACKUP_DIR not set — SQLite data is not being backed up');
    }
    return;
  }

  const run = () =>
    backupDatabase(backupDir)
      .then(dest => console.log(`DB backup written to ${dest}`))
      .catch(err => console.error('DB backup failed:', err));

  void run();
  setInterval(run, backupIntervalMinutes * 60 * 1000).unref();
}
