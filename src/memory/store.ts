import { InMemoryStore } from "@langchain/langgraph";
import { type Config } from "../config/schema.js";

export type MemoryStore = InMemoryStore;

let _store: InMemoryStore | null = null;

/**
 * Returns a singleton LangGraph memory store.
 *
 * In development "memory" mode this is an in-process InMemoryStore.
 * For production, swap this for a PostgresStore backed by config.memory.postgres_url.
 *
 * The store is used as the StoreBackend for cross-thread persistent memory
 * and for the CompositeBackend /memories/ route.
 */
export function getMemoryStore(config: Config): InMemoryStore {
  if (_store) return _store;

  if (config.memory.backend === "memory") {
    _store = new InMemoryStore();
    console.log("[memory] Using InMemoryStore (cross-thread persistent)");
  } else {
    // ephemeral — still need a store object for the agent; data won't outlive the process
    _store = new InMemoryStore();
    console.log("[memory] Using ephemeral InMemoryStore");
  }

  return _store;
}

/**
 * Save a memory entry for a user namespace.
 */
export async function saveMemory(
  store: InMemoryStore,
  userId: string,
  key: string,
  value: unknown,
): Promise<void> {
  await store.put(["memories", userId], key, value as Record<string, unknown>);
}

/**
 * Retrieve all memory entries for a user.
 */
export async function getMemories(
  store: InMemoryStore,
  userId: string,
): Promise<Array<{ key: string; value: unknown }>> {
  const results = await store.search(["memories", userId]);
  return results.map((r) => ({ key: r.key, value: r.value }));
}
