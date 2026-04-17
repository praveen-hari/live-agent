/**
 * Thread & Message CRUD operations backed by SQLite.
 */

import { getDb } from "./sqlite.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ThreadRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  raw_json: string | null;
  created_at: string;
}

export interface MemoryRow {
  id: number;
  key: string;
  content: string;
  category: string;
  namespace: string;
  created_at: string;
  updated_at: string;
}

// ── Threads ────────────────────────────────────────────────────────────────

export function listThreads(): ThreadRow[] {
  return getDb()
    .prepare("SELECT * FROM threads ORDER BY updated_at DESC")
    .all() as ThreadRow[];
}

export function getThread(id: string): ThreadRow | undefined {
  return getDb()
    .prepare("SELECT * FROM threads WHERE id = ?")
    .get(id) as ThreadRow | undefined;
}

export function upsertThread(id: string, title: string): ThreadRow {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getThread(id);
  if (existing) {
    db.prepare("UPDATE threads SET title = ?, updated_at = ? WHERE id = ?").run(title, now, id);
  } else {
    db.prepare(
      "INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    ).run(id, title, now, now);
  }
  return getThread(id)!;
}

export function touchThread(id: string): void {
  getDb()
    .prepare("UPDATE threads SET updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}

export function deleteThread(id: string): void {
  // Messages cascade-delete via FK
  getDb().prepare("DELETE FROM threads WHERE id = ?").run(id);
}

// ── Messages ───────────────────────────────────────────────────────────────

export function getMessages(threadId: string): MessageRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC",
    )
    .all(threadId) as MessageRow[];
}

export function upsertMessage(
  id: string,
  threadId: string,
  role: string,
  content: string,
  rawJson?: unknown,
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db
    .prepare("SELECT id FROM messages WHERE id = ?")
    .get(id);
  if (existing) {
    db.prepare(
      "UPDATE messages SET content = ?, raw_json = ? WHERE id = ?",
    ).run(content, rawJson ? JSON.stringify(rawJson) : null, id);
  } else {
    db.prepare(
      "INSERT INTO messages (id, thread_id, role, content, raw_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      id,
      threadId,
      role,
      content,
      rawJson ? JSON.stringify(rawJson) : null,
      now,
    );
  }
}

/** Bulk-replace all messages for a thread (called after `values` SSE event). */
export function replaceMessages(
  threadId: string,
  rows: Array<{ id: string; role: string; content: string; raw?: unknown }>,
): void {
  const db = getDb();
  const del = db.prepare("DELETE FROM messages WHERE thread_id = ?");
  const ins = db.prepare(
    "INSERT INTO messages (id, thread_id, role, content, raw_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const now = new Date().toISOString();
  db.transaction(() => {
    del.run(threadId);
    for (const r of rows) {
      ins.run(r.id, threadId, r.role, r.content, r.raw ? JSON.stringify(r.raw) : null, now);
    }
  })();
}

// ── Memory ─────────────────────────────────────────────────────────────────

export function listMemory(namespace = "default"): MemoryRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM memory WHERE namespace = ? ORDER BY updated_at DESC",
    )
    .all(namespace) as MemoryRow[];
}

export function upsertMemory(
  key: string,
  content: string,
  category = "general",
  namespace = "default",
): MemoryRow {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db.prepare("SELECT id FROM memory WHERE key = ?").get(key);
  if (existing) {
    db.prepare(
      "UPDATE memory SET content = ?, category = ?, namespace = ?, updated_at = ? WHERE key = ?",
    ).run(content, category, namespace, now, key);
  } else {
    db.prepare(
      "INSERT INTO memory (key, content, category, namespace, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(key, content, category, namespace, now, now);
  }
  return db.prepare("SELECT * FROM memory WHERE key = ?").get(key) as MemoryRow;
}

export function deleteMemoryByKey(key: string): void {
  getDb().prepare("DELETE FROM memory WHERE key = ?").run(key);
}

export function deleteMemoryById(id: number): void {
  getDb().prepare("DELETE FROM memory WHERE id = ?").run(id);
}
