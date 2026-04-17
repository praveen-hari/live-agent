import express, { type Request, type Response } from "express";
import { createServer } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import crypto from "crypto";

import { type Config } from "../config/schema.js";
import { type LiveAgent, invokeAgent } from "../agent/core.js";

/**
 * HTTP + WebSocket gateway — mirrors ZeroClaw's gateway module.
 *
 * HTTP endpoints:
 *   POST /chat        — single-turn message (JSON body: { message, thread_id? })
 *   GET  /health      — liveness probe
 *
 * WebSocket:
 *   ws://host:port/ws — persistent session; send/receive JSON messages
 *
 * Webhook verification uses HMAC-SHA256 over the raw body with the
 * configured gateway.secret.
 */
export function startGateway(config: Config, agent: LiveAgent): void {
  if (!config.gateway.enabled) return;

  const app = express();
  app.use(express.json());

  // ── Health check ────────────────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", agent: config.agent.name });
  });

  // ── Chat endpoint ────────────────────────────────────────────────────────
  app.post("/chat", verifySignature(config.gateway.secret), async (req: Request, res: Response) => {
    const { message, thread_id } = req.body as {
      message?: string;
      thread_id?: string;
    };

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const threadId = thread_id ?? `http-${Date.now()}`;

    try {
      const reply = await invokeAgent(agent, message, threadId);
      res.json({ reply, thread_id: threadId });
    } catch (err) {
      console.error("[gateway] Chat error:", err);
      res.status(500).json({ error: "Agent error" });
    }
  });

  // ── HTTP server + WebSocket ──────────────────────────────────────────────
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req) => {
    const threadId = `ws-${Date.now()}`;
    console.log(`[gateway] WebSocket connected (thread: ${threadId}) from ${req.socket.remoteAddress}`);

    ws.on("message", async (data) => {
      let message: string;
      try {
        const parsed = JSON.parse(data.toString()) as { message?: string };
        message = parsed.message ?? data.toString();
      } catch {
        message = data.toString();
      }

      try {
        ws.send(JSON.stringify({ type: "thinking" }));
        const reply = await invokeAgent(agent, message, threadId);
        ws.send(JSON.stringify({ type: "reply", content: reply, thread_id: threadId }));
      } catch (err) {
        console.error("[gateway] WS error:", err);
        ws.send(JSON.stringify({ type: "error", content: "Agent error" }));
      }
    });

    ws.on("close", () => {
      console.log(`[gateway] WebSocket disconnected (thread: ${threadId})`);
    });
  });

  const { host, port } = config.gateway;
  server.listen(port, host, () => {
    console.log(`[gateway] Listening on http://${host}:${port}`);
    console.log(`[gateway] WebSocket at ws://${host}:${port}/ws`);
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
