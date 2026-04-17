import { useEffect, useState } from "react";
import { getMemory, storeMemory, deleteMemory } from "@/lib/api";
import type { MemoryEntry } from "@/types/api";
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Search,
  Database,
} from "lucide-react";

export default function Memory() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    try {
      setError(null);
      const data = await getMemory();
      setEntries(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load memory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAdd() {
    if (!newContent.trim()) return;
    setAdding(true);
    try {
      const entry = await storeMemory(newContent.trim());
      setEntries((prev) => [entry, ...prev]);
      setNewContent("");
      setShowAdd(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to store memory");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMemory(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete memory");
    }
  }

  const filtered = entries.filter((e) =>
    e.content.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Memory</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {entries.length} entries stored
          </p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-md p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {showAdd && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
          <textarea
            rows={3}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Memory content…"
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-600"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={adding || !newContent.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-md transition-colors"
            >
              {adding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search memory…"
          className="w-full bg-gray-900 border border-gray-800 rounded-md pl-9 pr-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-600"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600 gap-2">
          <Database className="w-6 h-6" />
          <p className="text-sm">No memory entries found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="group bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex gap-3 hover:border-gray-700 transition-colors"
            >
              <p className="flex-1 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {entry.content}
              </p>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {entry.created_at && (
                  <span className="text-xs text-gray-600 font-mono">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
