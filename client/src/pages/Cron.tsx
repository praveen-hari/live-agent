import { useState, useEffect } from "react";
import {
  Clock,
  AlertCircle,
  Play,
  Pause,
  Loader2,
} from "lucide-react";
import type { CronJob } from "@/types/api";

// Cron jobs come from config — we display them read-only for now.
// The backend exposes them via /api/status (or a dedicated endpoint).
async function fetchCronJobs(): Promise<CronJob[]> {
  try {
    const res = await fetch("/api/cron");
    if (!res.ok) return [];
    return (await res.json()) as CronJob[];
  } catch {
    return [];
  }
}

export default function Cron() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCronJobs()
      .then(setJobs)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load cron jobs"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Cron Jobs</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Scheduled agent tasks
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
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600 gap-2">
          <Clock className="w-6 h-6" />
          <p className="text-sm">No cron jobs configured</p>
          <p className="text-xs text-gray-700">
            Add jobs to{" "}
            <code className="font-mono text-gray-500">config.toml</code> under{" "}
            <code className="font-mono text-gray-500">[cron]</code>
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-start gap-3"
            >
              <div className="mt-0.5">
                {job.enabled ? (
                  <Play className="w-4 h-4 text-green-400" />
                ) : (
                  <Pause className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded">
                    {job.schedule}
                  </code>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      job.enabled
                        ? "bg-green-950/40 text-green-400"
                        : "bg-gray-800 text-gray-600"
                    }`}
                  >
                    {job.enabled ? "active" : "paused"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-300 truncate">
                  {job.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
