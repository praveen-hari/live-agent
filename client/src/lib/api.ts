import type {
  StatusResponse,
  MemoryEntry,
  MemoryListResponse,
  SkillsResponse,
  LogsResponse,
} from "@/types/api";

const BASE = "";

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Status ────────────────────────────────────────────────────────────────

interface RawStatusResponse {
  name?: string;
  model?: string;
  uptime_seconds?: number;
  uptime?: number;
  memory_backend?: string;
  channels?: Record<string, boolean> | string[];
  tools?: Record<string, boolean> | string[];
  cron_jobs?: number;
  status?: string;
}

export async function getStatus(): Promise<StatusResponse> {
  const raw = await apiFetch<RawStatusResponse>("/api/status");

  const channels = Array.isArray(raw.channels)
    ? raw.channels
    : Object.entries(raw.channels ?? {})
        .filter(([, enabled]) => enabled)
        .map(([name]) => name);

  const tools = Array.isArray(raw.tools)
    ? raw.tools
    : Object.entries(raw.tools ?? {})
        .filter(([, enabled]) => enabled)
        .map(([name]) => name);

  return {
    status: "ok",
    model: raw.model ?? "",
    uptime: raw.uptime ?? raw.uptime_seconds ?? 0,
    memory_backend: raw.memory_backend ?? "",
    channels,
    tools,
  };
}

// ─── Memory ────────────────────────────────────────────────────────────────

export async function getMemory(): Promise<MemoryEntry[]> {
  const data = await apiFetch<MemoryListResponse | MemoryEntry[]>("/api/memory");
  if (Array.isArray(data)) return data;
  return data.entries ?? [];
}

export async function storeMemory(
  content: string,
  namespace?: string,
): Promise<MemoryEntry> {
  return apiFetch<MemoryEntry>("/api/memory", {
    method: "POST",
    body: JSON.stringify({ content, namespace }),
  });
}

export async function deleteMemory(id: string): Promise<void> {
  await apiFetch<unknown>(`/api/memory/${id}`, { method: "DELETE" });
}

// ─── Skills ────────────────────────────────────────────────────────────────

export async function getSkills(): Promise<SkillsResponse["skills"]> {
  const data = await apiFetch<SkillsResponse | SkillsResponse["skills"]>("/api/skills");
  if (Array.isArray(data)) return data;
  return data.skills ?? [];
}

// ─── Logs ──────────────────────────────────────────────────────────────────

export async function getLogs(): Promise<LogsResponse["logs"]> {
  const data = await apiFetch<LogsResponse | LogsResponse["logs"]>("/api/logs");
  // Backend LogEntry uses `timestamp`; normalise to `ts` expected by client types
  const entries = Array.isArray(data) ? data : (data.logs ?? []);
  return entries.map((e) => ({
    ...e,
    ts: e.ts ?? (e as unknown as Record<string, string>)["timestamp"] ?? "",
  }));
}

// ─── Health ────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch("/health");
    return res.ok;
  } catch {
    return false;
  }
}
