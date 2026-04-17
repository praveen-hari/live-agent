import express, { type Request, type Response } from "express";
import { createServer } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { type Config } from "../config/schema.js";
import { type LiveAgent, streamAgent } from "../agent/core.js";
import { getMemoryStore, saveMemory, getMemories } from "../memory/store.js";
import { getLogs } from "../observability/logs.js";
import { listSkills } from "../skills/index.js";

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

  // ── Memory API ────────────────────────────────────────────────────────────
  app.get("/api/memory", async (_req: Request, res: Response) => {
    try {
      const store = getMemoryStore(config);
      const userId = "default";
      const entries = await getMemories(store, userId);
      res.json(entries.map((e, i) => ({
        id: String(i),
        key: e.key,
        content: typeof e.value === "object" ? JSON.stringify(e.value) : String(e.value),
        category: "memory",
        timestamp: new Date().toISOString(),
      })));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/memory", async (req: Request, res: Response) => {
    const { key, content, category } = req.body as { key?: string; content?: string; category?: string };
    if (!key || !content) { res.status(400).json({ error: "key and content required" }); return; }
    try {
      const store = getMemoryStore(config);
      await saveMemory(store, "default", key, { content, category: category ?? "general" });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/memory/:key", async (req: Request, res: Response) => {
    // InMemoryStore doesn't expose direct delete; mark as deleted with empty value
    try {
      const store = getMemoryStore(config);
      await saveMemory(store, "default", req.params["key"] ?? "", { _deleted: true });
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
