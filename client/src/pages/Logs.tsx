import { useEffect, useState, useRef, useCallback } from "react";
import { getLogs } from "@/lib/api";
import type { LogEntry } from "@/types/api";
import { ScrollText, Loader2, RefreshCw, AlertCircle } from "lucide-react";

function levelColor(level: LogEntry["level"]) {
  switch (level) {
    case "error":
      return "text-red-400";
    case "warn":
      return "text-yellow-400";
    default:
      return "text-gray-400";
  }
}

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await getLogs();
      setLogs(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // load is async — setState is called after awaiting, never synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => {
      void load();
    }, 3000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Logs</h2>
          <p className="text-sm text-gray-500 mt-0.5">{logs.length} entries</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-blue-600"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => void load()}
            className="p-1.5 rounded-md hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-md p-3 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-gray-900 border border-gray-800 rounded-lg font-mono text-xs">
        {loading && logs.length === 0 ? (
          <div className="flex items-center gap-2 text-gray-500 p-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600 gap-2">
            <ScrollText className="w-6 h-6" />
            <p>No log entries</p>
          </div>
        ) : (
          <div className="p-3 space-y-0.5">
            {logs.map((entry, i) => (
              <div key={`${entry.ts}-${i}`} className="flex gap-2">
                <span className="text-gray-700 shrink-0">
                  {new Date(entry.ts).toLocaleTimeString()}
                </span>
                <span
                  className={`w-10 shrink-0 font-semibold ${levelColor(entry.level)}`}
                >
                  {entry.level.toUpperCase()}
                </span>
                <span className="text-gray-300 break-all">{entry.message}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
