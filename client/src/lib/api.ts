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

export async function getStatus(): Promise<StatusResponse> {
  return apiFetch<StatusResponse>("/api/status");
}

// ─── Memory ────────────────────────────────────────────────────────────────

export async function getMemory(): Promise<MemoryEntry[]> {
  const data = await apiFetch<MemoryListResponse>("/api/memory");
  return data.entries;
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
  const data = await apiFetch<SkillsResponse>("/api/skills");
  return data.skills;
}

// ─── Logs ──────────────────────────────────────────────────────────────────

export async function getLogs(): Promise<LogsResponse["logs"]> {
  const data = await apiFetch<LogsResponse>("/api/logs");
  return data.logs;
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
