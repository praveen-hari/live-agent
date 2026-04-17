/**
 * SQLite singleton — opens (or creates) the live-agent database.
 *
 * Schema:
 *   threads   — conversation thread list
 *   messages  — all chat messages (user + assistant + tool)
 *   memory    — persistent key/value memory store
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Store DB next to src/ so it survives dev restarts
const DB_PATH = path.resolve(__dirname, "../../data/live-agent.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure data/ directory exists
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  migrate(_db);
  return _db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS threads (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT 'New Thread',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT PRIMARY KEY,
      thread_id   TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      role        TEXT NOT NULL,          -- 'user' | 'assistant' | 'tool'
      content     TEXT NOT NULL DEFAULT '',
      raw_json    TEXT,                   -- full RawMessage JSON for tool-call details
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at);

    CREATE TABLE IF NOT EXISTS memory (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key         TEXT NOT NULL UNIQUE,
      content     TEXT NOT NULL,
      category    TEXT NOT NULL DEFAULT 'general',
      namespace   TEXT NOT NULL DEFAULT 'default',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_memory_namespace ON memory(namespace);
  `);
}
