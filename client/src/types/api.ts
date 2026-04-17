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

// ─── Tool calls ────────────────────────────────────────────────────────────

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: "pending" | "completed" | "error" | "interrupted";
}

export interface SubAgent {
  id: string;
  name: string;
  subAgentName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: "pending" | "active" | "completed" | "error";
}

// ─── Thread management ─────────────────────────────────────────────────────

export interface Thread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Raw message (from SSE values event) ─────────────────────────────────

export interface RawMessage {
  id: string;
  type: "human" | "ai" | "tool" | "system";
  content: string;
  tool_calls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  tool_call_id?: string;
  additional_kwargs?: Record<string, unknown>;
  response_metadata?: Record<string, unknown>;
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
