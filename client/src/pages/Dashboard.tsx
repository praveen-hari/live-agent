import { useEffect, useState } from "react";
import { getStatus } from "@/lib/api";
import type { StatusResponse } from "@/types/api";
import {
  Cpu,
  MessagesSquare,
  Wrench,
  Database,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex gap-4">
      <div className="p-2 bg-gray-800 rounded-md self-start">
        <Icon className="w-4 h-4 text-blue-400" />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-gray-100">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function Dashboard() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStatus()
      .then(setStatus)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to fetch status"),
      );
    const interval = setInterval(() => {
      getStatus().then(setStatus).catch(() => {});
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">System Overview</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Live Agent runtime status
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-md p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {!status && !error && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      )}

      {status && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard
              icon={Cpu}
              label="Model"
              value={status.model}
              sub={`Status: ${status.status}`}
            />
            <StatCard
              icon={Clock}
              label="Uptime"
              value={formatUptime(status.uptime)}
            />
            <StatCard
              icon={Database}
              label="Memory Backend"
              value={status.memory_backend}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessagesSquare className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-gray-200">
                  Active Channels
                </span>
              </div>
              {status.channels.length === 0 ? (
                <p className="text-xs text-gray-600">No channels configured</p>
              ) : (
                <ul className="space-y-1">
                  {status.channels.map((ch) => (
                    <li
                      key={ch}
                      className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 inline-block mr-1"
                    >
                      {ch}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-gray-200">
                  Available Tools
                </span>
              </div>
              {status.tools.length === 0 ? (
                <p className="text-xs text-gray-600">No tools registered</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {status.tools.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-800/40"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
