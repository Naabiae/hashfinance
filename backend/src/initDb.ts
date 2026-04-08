import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'rwa_hub.db');
const db = new Database(dbPath);

console.log('Initializing database at', dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS payfi_mandates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  mandate_id   TEXT UNIQUE NOT NULL,
  user_address TEXT NOT NULL,
  amount       TEXT NOT NULL,
  active       BOOLEAN DEFAULT 1,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS swaps (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash      TEXT UNIQUE NOT NULL,
  block_number INTEGER NOT NULL,
  timestamp    INTEGER NOT NULL,
  user_address TEXT NOT NULL,
  token_in     TEXT NOT NULL,
  token_out    TEXT NOT NULL,
  amount_in    TEXT NOT NULL,
  amount_out   TEXT NOT NULL,
  price        TEXT NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

console.log('Database schema created/verified successfully.');
db.close();
