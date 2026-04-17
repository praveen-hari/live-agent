// ─── WebSocket messages ────────────────────────────────────────────────────

export interface WsThinkingMessage {
  type: "thinking";
}

export interface WsChunkMessage {
  type: "chunk";
  content: string;
}

export interface WsDoneMessage {
  type: "done";
  full_response: string;
  thread_id?: string;
}

export interface WsErrorMessage {
  type: "error";
  error: string;
}

export interface WsTodoMessage {
  type: "todos";
  todos: AgentTodo[];
}

export type WsMessage =
  | WsThinkingMessage
  | WsChunkMessage
  | WsDoneMessage
  | WsErrorMessage
  | WsTodoMessage;

// ─── Agent state ───────────────────────────────────────────────────────────

export interface AgentTodo {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "done";
}

// ─── REST API types ────────────────────────────────────────────────────────

export interface StatusResponse {
  status: "ok";
  uptime: number;
  model: string;
  channels: string[];
  tools: string[];
  memory_backend: string;
}

export interface MemoryEntry {
  id: string;
  content: string;
  namespace?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryListResponse {
  entries: MemoryEntry[];
}

export interface CronJob {
  id: string;
  schedule: string;
  message: string;
  enabled: boolean;
}

export interface Skill {
  name: string;
  description: string;
  instructions?: string;
}

export interface SkillsResponse {
  skills: Skill[];
}

export interface LogEntry {
  ts: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface LogsResponse {
  logs: LogEntry[];
}
