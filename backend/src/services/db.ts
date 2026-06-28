import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Campaign } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '../../data/shieldfund.db');

// Ensure data directory exists
import { mkdirSync } from 'fs';
mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id       TEXT PRIMARY KEY,
    title    TEXT NOT NULL,
    goal     TEXT NOT NULL,
    metadata TEXT
  );
`);

const insertCampaign = db.prepare<[string, string, string, string | null]>(
  'INSERT OR REPLACE INTO campaigns (id, title, goal, metadata) VALUES (?, ?, ?, ?)'
);

const getCampaignById = db.prepare<[string], { id: string; title: string; goal: string; metadata: string | null }>(
  'SELECT * FROM campaigns WHERE id = ?'
);

const getAllCampaigns = db.prepare<[], { id: string; title: string; goal: string; metadata: string | null }>(
  'SELECT * FROM campaigns ORDER BY rowid DESC'
);

function rowToCampaign(row: { id: string; title: string; goal: string; metadata: string | null }): Campaign {
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
  };
}

export const campaignDb = {
  upsert(campaign: Campaign): void {
    insertCampaign.run(
      campaign.id,
      campaign.title,
      campaign.goal,
      campaign.metadata ? JSON.stringify(campaign.metadata) : null,
    );
  },

  findById(id: string): Campaign | undefined {
    const row = getCampaignById.get(id);
    return row ? rowToCampaign(row) : undefined;
  },

  findAll(): Campaign[] {
    return (getAllCampaigns.all() as Array<{ id: string; title: string; goal: string; metadata: string | null }>).map(rowToCampaign);
  },
};
