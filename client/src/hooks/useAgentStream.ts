/**
 * useAgentStream — direct SSE streaming hook.
 *
 * Reads the /stream SSE endpoint token-by-token and updates React state
 * on every chunk so the UI renders in real time.
 *
 * Unlike useStream (FetchStreamTransport), this hook does NOT wait for a
 * final `values` event to update stream.messages — every `messages` SSE
 * event causes an immediate state update.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { RawMessage, Thread } from "@/types/api";

// Yield to the browser so it can paint before we process the next token.
const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface UseAgentStreamReturn {
  messages: ChatMessage[];
  rawMessages: RawMessage[];
  isStreaming: boolean;
  error: string | null;
  threadId: string | null;
  threads: Thread[];
  send: (text: string) => Promise<void>;
  stop: () => void;
  clearError: () => void;
  startNewThread: () => void;
  switchThread: (id: string) => void;
  deleteThread: (id: string) => void;
}

// ── Backend base URL ───────────────────────────────────────────────────────────
const API_BASE = import.meta.env.DEV ? "http://localhost:8080" : "";

// ── SQLite-backed API helpers ──────────────────────────────────────────────────

interface ThreadApiRow { id: string; title: string; created_at: string; updated_at: string; }
interface MessageApiRow { id: string; thread_id: string; role: string; content: string; raw: RawMessage | null; created_at: string; }

async function apiFetchThreads(): Promise<Thread[]> {
  try {
    const res = await fetch(`${API_BASE}/api/threads`);
    if (!res.ok) return [];
    const rows = await res.json() as ThreadApiRow[];
    return rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at }));
  } catch { return []; }
}

async function apiCreateThread(id: string, title: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title }),
    });
  } catch { /* non-fatal */ }
}

async function apiDeleteThread(id: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/threads/${id}`, { method: "DELETE" });
  } catch { /* non-fatal */ }
}

async function apiFetchMessages(threadId: string): Promise<{ chat: ChatMessage[]; raw: RawMessage[] }> {
  try {
    const res = await fetch(`${API_BASE}/api/threads/${threadId}/messages`);
    if (!res.ok) return { chat: [], raw: [] };
    const rows = await res.json() as MessageApiRow[];
    const chat: ChatMessage[] = rows
      .filter((r) => r.role === "user" || r.role === "assistant")
      .map((r) => ({
        id: r.id,
        role: r.role as "user" | "assistant",
        content: r.content,
        timestamp: new Date(r.created_at),
      }));
    const raw: RawMessage[] = rows
      .map((r) => r.raw)
      .filter((r): r is RawMessage => r !== null);
    return { chat, raw };
  } catch { return { chat: [], raw: [] }; }
}

// ── localStorage cache (fast reads while API loads) ───────────────────────────
const LS_THREADS = "live-agent:threads";
const LS_MSG_PREFIX = "live-agent:messages:";
const LS_RAW_PREFIX = "live-agent:raw:";

function lsLoadThreads(): Thread[] {
  try { return JSON.parse(localStorage.getItem(LS_THREADS) ?? "[]") as Thread[]; } catch { return []; }
}
function lsSaveThreads(t: Thread[]) { localStorage.setItem(LS_THREADS, JSON.stringify(t)); }
function lsLoadMessages(tid: string): ChatMessage[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_MSG_PREFIX + tid) ?? "[]") as Array<{ id: string; role: string; content: string; timestamp: string }>;
    return raw.map((m) => ({ ...m, role: m.role as "user" | "assistant", timestamp: new Date(m.timestamp) }));
  } catch { return []; }
}
function lsSaveMessages(tid: string, msgs: ChatMessage[]) { localStorage.setItem(LS_MSG_PREFIX + tid, JSON.stringify(msgs)); }
function lsLoadRaw(tid: string): RawMessage[] {
  try { return JSON.parse(localStorage.getItem(LS_RAW_PREFIX + tid) ?? "[]") as RawMessage[]; } catch { return []; }
}
function lsSaveRaw(tid: string, raw: RawMessage[]) { localStorage.setItem(LS_RAW_PREFIX + tid, JSON.stringify(raw)); }

export function useAgentStream(): UseAgentStreamReturn {
  // Boot from localStorage immediately for instant paint, then hydrate from SQLite API
  const [threads, setThreads] = useState<Thread[]>(() => lsLoadThreads());
  const latestThread = threads[0] ?? null;

  const [threadId, setThreadId] = useState<string | null>(latestThread?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    latestThread ? lsLoadMessages(latestThread.id) : [],
  );
  const [rawMessages, setRawMessages] = useState<RawMessage[]>(() =>
    latestThread ? lsLoadRaw(latestThread.id) : [],
  );

  // Hydrate threads from SQLite on mount
  useEffect(() => {
    apiFetchThreads().then((apiThreads) => {
      if (apiThreads.length > 0) {
        setThreads(apiThreads);
        lsSaveThreads(apiThreads);
        // Load messages for the first thread if none loaded yet
        const first = apiThreads[0];
        if (first && messages.length === 0) {
          apiFetchMessages(first.id).then(({ chat, raw }) => {
            if (chat.length > 0) {
              setMessages(chat);
              setRawMessages(raw);
              lsSaveMessages(first.id, chat);
              lsSaveRaw(first.id, raw);
            }
          });
          setThreadId(first.id);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to the AbortController so stop() can cancel in-flight fetch
  const abortRef = useRef<AbortController | null>(null);
  // Ref that tracks the current streaming message ID
  const streamingIdRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const startNewThread = useCallback(() => {
    const newId = `thread-${Date.now()}`;
    setThreadId(newId);
    setMessages([]);
    setRawMessages([]);
    setError(null);
  }, []);

  const switchThread = useCallback((id: string) => {
    setThreadId(id);
    // Show localStorage cache immediately for instant paint
    setMessages(lsLoadMessages(id));
    setRawMessages(lsLoadRaw(id));
    setError(null);
    // Then hydrate from SQLite
    apiFetchMessages(id).then(({ chat, raw }) => {
      if (chat.length > 0) {
        setMessages(chat);
        setRawMessages(raw);
        lsSaveMessages(id, chat);
        lsSaveRaw(id, raw);
      }
    });
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (isStreaming || !text.trim()) return;

      // ── 1. Optimistically add the user message ─────────────────────────
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      // ── 2. Add empty AI placeholder ────────────────────────────────────
      const aiMsgId = `ai-${Date.now()}`;
      streamingIdRef.current = aiMsgId;
      const aiPlaceholder: ChatMessage = {
        id: aiMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      const currentThreadId = threadId ?? `thread-${Date.now()}`;

      // ── 2a. Create or update thread in localStorage + SQLite ──────────
      const now = new Date().toISOString();
      const threadTitle = text.trim().slice(0, 60);
      setThreads((prev) => {
        const existing = prev.find((t) => t.id === currentThreadId);
        let next: Thread[];
        if (existing) {
          next = prev.map((t) =>
            t.id === currentThreadId ? { ...t, updatedAt: now } : t,
          );
        } else {
          const newThread: Thread = {
            id: currentThreadId,
            title: threadTitle,
            createdAt: now,
            updatedAt: now,
          };
          next = [newThread, ...prev];
        }
        lsSaveThreads(next);
        return next;
      });
      // Persist to SQLite (fire-and-forget)
      apiCreateThread(currentThreadId, threadTitle);

      setMessages((prev) => {
        const updated = [...prev, userMsg, aiPlaceholder];
        lsSaveMessages(currentThreadId, updated);
        return updated;
      });
      setIsStreaming(true);
      setError(null);
      if (!threadId) setThreadId(currentThreadId);

      // Build the input using the current thread ID (for conversation continuity)
      const body = {
        input: {
          messages: [{ type: "human", content: text.trim() }],
        },
        config: {
          configurable: { thread_id: currentThreadId },
        },
      };

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        // Bypass the Vite dev proxy for SSE — http-proxy buffers the stream
        // and sends everything in one burst. Going directly to the backend
        // (which has CORS enabled) gives true token-by-token streaming.
        const streamUrl = import.meta.env.DEV
          ? "http://localhost:8080/stream"
          : "/stream";
        const response = await fetch(streamUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ac.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        if (!response.body) {
          throw new Error("No response body");
        }

        // ── 3. Read SSE line by line ───────────────────────────────────
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = "";

        const processLine = async (line: string) => {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const rawData = line.slice(5).trim();
            try {
              const data = JSON.parse(rawData);

              if (currentEvent === "metadata") {
                // Capture thread ID from metadata event
                if (data.thread_id) setThreadId(data.thread_id as string);

              } else if (currentEvent === "messages") {
                // data = [AIMessageChunk, metadata]
                const chunk = Array.isArray(data) ? data[0] : data;
                let token = "";
                if (typeof chunk?.content === "string") {
                  token = chunk.content;
                } else if (Array.isArray(chunk?.content)) {
                  // Claude sends content as [{type:"text", text:"..."}] blocks
                  token = (chunk.content as Array<unknown>)
                    .map((c) =>
                      typeof c === "string" ? c : (c as Record<string, string>)?.text ?? "",
                    )
                    .join("");
                }
                if (token) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === streamingIdRef.current
                        ? { ...m, content: m.content + token }
                        : m,
                    ),
                  );
                  // Yield to the browser so it paints this token before the next one.
                  // Without this, all tokens from one TCP packet render simultaneously.
                  await yieldToBrowser();
                }

              } else if (currentEvent === "values") {
                // Replace accumulated messages with the authoritative server state
                // Also store raw messages (including tool calls) for ToolCallBox rendering
                const serverMsgs: RawMessage[] = data?.messages ?? [];
                if (serverMsgs.length > 0) {
                  // Filter to displayable message types for chat UI
                  const displayable = serverMsgs.filter(
                    (m) =>
                      m.type === "human" ||
                      m.type === "ai" ||
                      m.type === "user" ||
                      m.type === "assistant",
                  );
                  const chatMsgs = displayable.map((m, i): ChatMessage => ({
                    id: m.id ?? `srv-${i}`,
                    role: m.type === "human" || m.type === "user" ? "user" : "assistant",
                    content: m.content ?? "",
                    timestamp: new Date(),
                  }));
                  setMessages(chatMsgs);
                  lsSaveMessages(currentThreadId, chatMsgs);
                  // Store ALL messages including tool type for processedMessages
                  setRawMessages(serverMsgs);
                  lsSaveRaw(currentThreadId, serverMsgs);
                  // Also refresh thread list timestamp from server
                  apiFetchThreads().then((apiThreads) => {
                    if (apiThreads.length > 0) {
                      setThreads(apiThreads);
                      lsSaveThreads(apiThreads);
                    }
                  });
                }

              } else if (currentEvent === "error") {
                setError(data?.message ?? data?.error ?? "Stream error");
              }
            } catch {
              // Ignore JSON parse errors for malformed SSE lines
            }
          } else if (line === "") {
            // Blank line = end of SSE event, reset current event type
            currentEvent = "";
          }
        };

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            await processLine(line);
          }
        }
        // Process any remaining buffer
        if (buffer) await processLine(buffer);
      } catch (err: unknown) {
        if ((err as { name?: string }).name !== "AbortError") {
          setError(
            err instanceof Error ? err.message : "Connection error",
          );
          // Remove the empty AI placeholder on error
          setMessages((prev) =>
            prev.filter((m) => m.id !== streamingIdRef.current),
          );
        }
      } finally {
        streamingIdRef.current = null;
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, threadId],
  );

  const deleteThread = useCallback(
    (id: string) => {
      // Remove from SQLite
      apiDeleteThread(id);
      // Remove from localStorage cache
      localStorage.removeItem(LS_MSG_PREFIX + id);
      localStorage.removeItem(LS_RAW_PREFIX + id);
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== id);
        lsSaveThreads(next);
        return next;
      });
      // If we deleted the active thread, switch to the next one or start fresh
      if (id === threadId) {
        const remaining = lsLoadThreads().filter((t) => t.id !== id);
        if (remaining.length > 0) {
          switchThread(remaining[0].id);
        } else {
          startNewThread();
        }
      }
    },
    [threadId, switchThread, startNewThread],
  );

  return {
    messages,
    rawMessages,
    isStreaming,
    error,
    threadId,
    threads,
    send,
    stop,
    clearError,
    startNewThread,
    switchThread,
    deleteThread,
  };
}
