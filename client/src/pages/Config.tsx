import { useEffect, useState } from "react";
import { getStatus } from "@/lib/api";
import type { StatusResponse } from "@/types/api";
import { Settings, Loader2, AlertCircle } from "lucide-react";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-gray-800 last:border-0">
      <span className="w-40 shrink-0 text-xs text-gray-500 uppercase tracking-wide pt-0.5">
        {label}
      </span>
      <span className="text-sm text-gray-200 break-all">{value}</span>
    </div>
  );
}

export default function Config() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStatus()
      .then(setStatus)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load config"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Configuration</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Current runtime configuration (read-only)
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-md p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : !status ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600 gap-2">
          <Settings className="w-6 h-6" />
          <p className="text-sm">No configuration available</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-4">
          <Row label="Model" value={<code className="font-mono text-blue-400">{status.model}</code>} />
          <Row label="Status" value={status.status} />
          <Row
            label="Memory"
            value={<code className="font-mono text-purple-400">{status.memory_backend}</code>}
          />
          <Row
            label="Channels"
            value={
              status.channels.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {status.channels.map((ch) => (
                    <span
                      key={ch}
                      className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300"
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-600">None</span>
              )
            }
          />
          <Row
            label="Tools"
            value={
              status.tools.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {status.tools.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 rounded-full bg-blue-950/40 text-blue-300 border border-blue-800/30"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-600">None</span>
              )
            }
          />
        </div>
      )}
    </div>
  );
}
