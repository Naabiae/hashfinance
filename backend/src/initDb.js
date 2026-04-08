"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dataDir = path_1.default.join(__dirname, '../../data');
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path_1.default.join(dataDir, 'rwa_hub.db');
const db = new better_sqlite3_1.default(dbPath);
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
//# sourceMappingURL=initDb.js.map