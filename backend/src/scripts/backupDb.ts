// One-off SQLite snapshot: `npm run db:backup [destDir]`
import { config } from '../config/index.js';
import { backupDatabase } from '../services/backup.js';
import { db } from '../services/db.js';

const destDir = process.argv[2] ?? (config.db.backupDir || './backups');

try {
  const dest = await backupDatabase(destDir);
  console.log(`Backup written to ${dest}`);
} finally {
  db.close();
}
