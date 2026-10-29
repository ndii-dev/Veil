import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Campaign } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '../../data/shieldfund.db');

// Ensure data directory exists
mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id       TEXT PRIMARY KEY,
    title    TEXT NOT NULL,
    goal     TEXT NOT NULL,
    metadata TEXT
  );
`);

type CampaignRow = { id: string; title: string; goal: string; metadata: string | null };

// Create-only: an existing campaign is never overwritten.
const insertCampaign = db.prepare<[string, string, string, string | null]>(
  'INSERT INTO campaigns (id, title, goal, metadata) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING'
);

const getCampaignById = db.prepare<[string], CampaignRow>(
  'SELECT * FROM campaigns WHERE id = ?'
);

const getCampaignPage = db.prepare<[number, number], CampaignRow>(
  'SELECT * FROM campaigns ORDER BY rowid DESC LIMIT ? OFFSET ?'
);

const countCampaigns = db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM campaigns');

function rowToCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
  };
}

export const campaignDb = {
  /** Returns false if a campaign with this id already exists. */
  create(campaign: Campaign): boolean {
    const result = insertCampaign.run(
      campaign.id,
      campaign.title,
      campaign.goal,
      campaign.metadata ? JSON.stringify(campaign.metadata) : null,
    );
    return result.changes === 1;
  },

  findById(id: string): Campaign | undefined {
    const row = getCampaignById.get(id);
    return row ? rowToCampaign(row) : undefined;
  },

  /** Newest first. */
  findPage(start: number, limit: number): { items: Campaign[]; total: number } {
    return {
      items: getCampaignPage.all(limit, start).map(rowToCampaign),
      total: countCampaigns.get()?.n ?? 0,
    };
  },
};
