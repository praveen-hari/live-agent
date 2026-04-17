import express, { type Request, type Response } from "express";
import { createServer } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { type Config } from "../config/schema.js";
import { type LiveAgent, type MessageDict, streamAgent } from "../agent/core.js";
import { getLogs } from "../observability/logs.js";
import { listSkills } from "../skills/index.js";
import {
  listThreads, getThread, upsertThread, touchThread, deleteThread,
  getMessages, replaceMessages,
  listMemory, upsertMemory, deleteMemoryByKey, deleteMemoryById,
} from "../db/threads.js";

const _startTime = Date.now();

/**
 * HTTP + WebSocket gateway.
 *
 * REST API:
 *   GET  /health              — liveness probe
 *   GET  /api/status          — agent/system status
 *   POST /chat                — single-turn HTTP chat
 *   GET  /api/memory          — list memory entries
 *   POST /api/memory          — store memory entry
 *   DELETE /api/memory/:key   — delete memory entry
 *   GET  /api/skills          — list built-in skills
 *   GET  /api/logs            — recent log entries
 *
 * WebSocket:
 *   ws://host:port/ws         — streaming chat (chunk / done / error events)
 */
export function startGateway(config: Config, agent: LiveAgent): void {
  if (!config.gateway.enabled) return;

  const app = express();
  app.use(express.json());

  // ── CORS for local dev ──────────────────────────────────────────────────
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Live-Agent-Signature");
    if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });

  // ── Health check ─────────────────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", agent: config.agent.name });
  });

  // ── Status ───────────────────────────────────────────────────────────────
  app.get("/api/status", (_req: Request, res: Response) => {
    res.json({
      name: config.agent.name,
      model: config.agent.model,
      uptime_seconds: Math.floor((Date.now() - _startTime) / 1000),
      memory_backend: config.memory.backend,
      gateway_port: config.gateway.port,
      channels: {
        telegram: config.channels.telegram.enabled,
        discord: config.channels.discord.enabled,
      },
      tools: {
        web_search: config.tools.web_search.enabled,
        browser: config.tools.browser.enabled,
        notifications: config.tools.notifications.enabled,
      },
      cron_jobs: config.cron.jobs.length,
    });
  });

  // ── Chat (single-turn HTTP) ───────────────────────────────────────────────
  app.post("/chat", verifySignature(config.gateway.secret), async (req: Request, res: Response) => {
    const { message, thread_id } = req.body as { message?: string; thread_id?: string };
    if (!message) { res.status(400).json({ error: "message is required" }); return; }

    const threadId = thread_id ?? `http-${Date.now()}`;
    let fullResponse = "";
    try {
      await streamAgent(agent, message, threadId, (token) => { fullResponse += token; });
      res.json({ reply: fullResponse, thread_id: threadId });
    } catch (err) {
      console.error("[gateway] Chat error:", err);
      res.status(500).json({ error: "Agent error" });
    }
  });

  // ── LangGraph-compatible SSE stream (used by @langchain/react useStream) ─
  // FetchStreamTransport POSTs here with:
  //   { input: { messages }, config: { configurable: { thread_id } } }
  // Returns SSE events: metadata → messages (chunks) → values (full state)
  app.post("/stream", async (req: Request, res: Response) => {
    const body = req.body as {
      input?: { messages?: Array<{ type?: string; role?: string; content?: string }> };
      config?: { configurable?: { thread_id?: string } };
    };

    const inputMessages = body.input?.messages ?? [];
    const threadId =
      body.config?.configurable?.thread_id ?? `thread-${Date.now()}`;

    // Extract the latest human message
    const userMsg =
      [...inputMessages]
        .reverse()
        .find(
          (m) =>
            (m.type ?? m.role) === "human" ||
            (m.type ?? m.role) === "user",
        )?.content ?? "";

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).flushHeaders?.();

    const runId = `run-${Date.now()}`;
    const msgId = `msg-${Date.now()}`;

    const sse = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      // Flush immediately so each SSE event is sent as soon as it's written
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (res as any).flush?.();
    };

    sse("metadata", { run_id: runId, thread_id: threadId });

    if (!userMsg) {
      sse("error", { error: "No user message", message: "No user message" });
      res.end();
      return;
    }

    let fullContent = "";
    let finalMessages: MessageDict[] = [];

    try {
      // Ensure thread exists in DB before streaming
    upsertThread(threadId, userMsg.slice(0, 60));

    finalMessages = await streamAgent(agent, userMsg, threadId, (token) => {
        fullContent += token;
        // messages-tuple format: [chunk, metadata]
        sse("messages", [
          {
            id: msgId,
            type: "AIMessageChunk",
            content: token,
            additional_kwargs: {},
            response_metadata: {},
          },
          { tags: [], langgraph_node: "agent", langgraph_step: 0 },
        ]);
      });
    } catch (err) {
      console.error("[gateway] /stream error:", err);
      sse("error", { error: "Agent error", message: String(err) });
      res.end();
      return;
    }

    // If checkpointer state fetch failed, build fallback from what we have
    if (finalMessages.length === 0) {
      finalMessages = [
        ...inputMessages.map((m, i): MessageDict => ({
          id: `user-${i}`,
          type: "human",
          content: m.content ?? "",
        })),
        {
          id: msgId,
          type: "ai",
          content: fullContent,
          additional_kwargs: {},
          response_metadata: {},
        },
      ];
    }

    // Persist final messages to SQLite
    replaceMessages(
      threadId,
      finalMessages.map((m) => ({
        id: m.id ?? `msg-${Date.now()}-${Math.random()}`,
        role: m.type === "human" ? "user" : "assistant",
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        raw: m,
      })),
    );
    touchThread(threadId);

    // Full state so the frontend can maintain conversation history
    sse("values", { messages: finalMessages });
    res.end();
  });

  // ── Threads API ──────────────────────────────────────────────────────────
  app.get("/api/threads", (_req: Request, res: Response) => {
    try {
      res.json(listThreads());
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/threads/:id", (req: Request, res: Response) => {
    const t = getThread(String(req.params["id"]));
    if (!t) { res.status(404).json({ error: "Thread not found" }); return; }
    res.json(t);
  });

  app.post("/api/threads", (req: Request, res: Response) => {
    const { id, title } = req.body as { id?: string; title?: string };
    if (!id) { res.status(400).json({ error: "id is required" }); return; }
    const t = upsertThread(id, title ?? "New Thread");
    res.json(t);
  });

  app.put("/api/threads/:id", (req: Request, res: Response) => {
    const { title } = req.body as { title?: string };
    const id = String(req.params["id"]);
    const existing = getThread(id);
    if (!existing) { res.status(404).json({ error: "Thread not found" }); return; }
    const t = upsertThread(id, title ?? existing.title);
    res.json(t);
  });

  app.delete("/api/threads/:id", (req: Request, res: Response) => {
    try {
      deleteThread(String(req.params["id"]));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Thread Messages API ────────────────────────────────────────────────────
  app.get("/api/threads/:id/messages", (req: Request, res: Response) => {
    const msgs = getMessages(String(req.params["id"]));
    res.json(msgs.map((m) => ({
      ...m,
      raw: m.raw_json ? JSON.parse(m.raw_json) : null,
    })));
  });

  app.post("/api/threads/:id/messages", (req: Request, res: Response) => {
    const threadId = String(req.params["id"]);
    const { messages } = req.body as {
      messages: Array<{ id: string; role: string; content: string; raw?: unknown }>
    };
    if (!Array.isArray(messages)) { res.status(400).json({ error: "messages array required" }); return; }
    // Ensure thread exists
    if (!getThread(threadId)) {
      upsertThread(threadId, "Thread");
    }
    replaceMessages(threadId, messages);
    touchThread(threadId);
    res.json({ ok: true, count: messages.length });
  });

  // ── Memory API (SQLite-backed) ─────────────────────────────────────────────
  app.get("/api/memory", (_req: Request, res: Response) => {
    try {
      const entries = listMemory();
      res.json(entries.map((e) => ({
        id: String(e.id),
        key: e.key,
        content: e.content,
        category: e.category,
        namespace: e.namespace,
        timestamp: e.updated_at,
      })));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/memory", (req: Request, res: Response) => {
    const { key, content, category, namespace } = req.body as {
      key?: string; content?: string; category?: string; namespace?: string;
    };
    if (!key || !content) { res.status(400).json({ error: "key and content required" }); return; }
    try {
      const row = upsertMemory(key, content, category, namespace);
      res.json({ id: String(row.id), key: row.key, content: row.content, category: row.category, timestamp: row.updated_at });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/memory/id/:id", (req: Request, res: Response) => {
    try {
      deleteMemoryById(Number(req.params["id"]));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/memory/:key", (req: Request, res: Response) => {
    try {
      deleteMemoryByKey(String(req.params["key"] ?? ""));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Skills API ────────────────────────────────────────────────────────────
  app.get("/api/skills", (_req: Request, res: Response) => {
    res.json(listSkills());
  });

  // ── Logs API ──────────────────────────────────────────────────────────────
  app.get("/api/logs", (req: Request, res: Response) => {
    const limit = parseInt(String(req.query["limit"] ?? "100"), 10);
    res.json(getLogs(limit));
  });

  // ── Serve React client (production build) ────────────────────────────────
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|health|chat).*/, (_req: Request, res: Response) => {
    const indexPath = path.join(clientDist, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: "Client not built. Run: cd client && npm run build" });
    }
  });

  // ── HTTP server + WebSocket ──────────────────────────────────────────────
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req) => {
    const threadId = `ws-${Date.now()}`;
    console.log(`[gateway] WS connected (${threadId}) from ${req.socket.remoteAddress}`);

    ws.on("message", async (data) => {
      let message: string;
      let clientThreadId: string | undefined;
      try {
        const parsed = JSON.parse(data.toString()) as { message?: string; thread_id?: string };
        message = parsed.message ?? data.toString();
        clientThreadId = parsed.thread_id;
      } catch {
        message = data.toString();
      }

      const tid = clientThreadId ?? threadId;

      try {
        ws.send(JSON.stringify({ type: "thinking" }));
        let fullResponse = "";
        await streamAgent(agent, message, tid, (token) => {
          fullResponse += token;
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: "chunk", content: token }));
          }
        });
        ws.send(JSON.stringify({ type: "done", full_response: fullResponse, thread_id: tid }));
      } catch (err) {
        console.error("[gateway] WS error:", err);
        ws.send(JSON.stringify({ type: "error", content: "Agent error" }));
      }
    });

    ws.on("close", () => console.log(`[gateway] WS disconnected (${threadId})`));
  });

  const { host, port } = config.gateway;
  server.listen(port, host, () => {
    console.log(`[gateway] http://${host}:${port}`);
    console.log(`[gateway] ws://${host}:${port}/ws`);
  });
}

// ── Middleware: HMAC-SHA256 signature verification ─────────────────────────

function verifySignature(secret: string) {
  return (req: Request, res: Response, next: () => void) => {
    // Skip verification if secret is the default placeholder
    if (secret === "change-me") {
      next();
      return;
    }

    const sig = req.headers["x-live-agent-signature"];
    if (!sig) {
      res.status(401).json({ error: "Missing signature header" });
      return;
    }

    const body = JSON.stringify(req.body);
    const expected = "sha256=" + crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(String(sig)), Buffer.from(expected))) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    next();
  };
}
