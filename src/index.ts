#!/usr/bin/env node
/**
 * live-agent — personal assistant CLI
 *
 * Usage:
 *   npx tsx src/index.ts              # interactive REPL
 *   npx tsx src/index.ts --serve      # start gateway + channels only
 *   npx tsx src/index.ts "your prompt" # one-shot
 */

import readline from "readline";
import "dotenv/config";

import { loadConfig } from "./config/loader.js";
import { getMemoryStore } from "./memory/store.js";
import { createLiveAgent, invokeAgent, streamAgent } from "./agent/core.js";
import { createWebSearchTool, fetchUrlTool } from "./tools/web-search.js";
import { createBrowserTool } from "./tools/browser.js";
import { createNotificationTool } from "./tools/notifications.js";
import { startGateway } from "./channels/gateway.js";
import { startTelegramChannel } from "./channels/telegram.js";
import { startDiscordChannel } from "./channels/discord.js";
import { startCronScheduler } from "./cron/scheduler.js";
import { type StructuredTool } from "@langchain/core/tools";

async function main() {
  const args = process.argv.slice(2);

  // ── Config ────────────────────────────────────────────────────────────────
  const config = loadConfig();

  // ── Observability ─────────────────────────────────────────────────────────
  if (config.observability.langsmith_tracing) {
    process.env["LANGSMITH_TRACING"] = "true";
    console.log("[observability] LangSmith tracing enabled");
  }

  // ── Memory ────────────────────────────────────────────────────────────────
  const store = getMemoryStore(config);

  // ── Tools ─────────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: StructuredTool[] = [];

  const webSearch = createWebSearchTool(config);
  if (webSearch) tools.push(webSearch as unknown as StructuredTool);
  tools.push(fetchUrlTool as unknown as StructuredTool);

  const browser = createBrowserTool(config);
  if (browser) tools.push(browser as unknown as StructuredTool);

  const notify = createNotificationTool(config);
  if (notify) tools.push(notify as unknown as StructuredTool);

  // ── Agent ─────────────────────────────────────────────────────────────────
  const agent = createLiveAgent({ config, store, tools });

  // ── Channels ─────────────────────────────────────────────────────────────
  startGateway(config, agent);
  startTelegramChannel(config, agent);
  startDiscordChannel(config, agent);

  // ── Cron ──────────────────────────────────────────────────────────────────
  startCronScheduler(config, agent);

  // ── CLI modes ─────────────────────────────────────────────────────────────

  // One-shot: live-agent "do something"
  if (args.length > 0 && !args[0]?.startsWith("--")) {
    const prompt = args.join(" ");
    const threadId = `cli-oneshot-${Date.now()}`;
    console.log(`\n[live-agent] ${prompt}\n`);
    process.stdout.write("[assistant] ");
    await streamAgent(agent, prompt, threadId, (token) => {
      process.stdout.write(token);
    });
    console.log("\n");
    process.exit(0);
  }

  // --serve: just run channels/gateway without REPL
  if (args.includes("--serve")) {
    console.log(
      `\n[live-agent] ${config.agent.name} running in server mode. Press Ctrl+C to stop.\n`,
    );
    return; // keep process alive via gateway/channel event loops
  }

  // Interactive REPL
  await startRepl(agent, config.agent.name);
}

async function startRepl(
  agent: Awaited<ReturnType<typeof createLiveAgent>>,
  agentName: string,
) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const threadId = `repl-${Date.now()}`;

  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  ${agentName.padEnd(36)}║`);
  console.log(`║  Type your message. Ctrl+C to quit.  ║`);
  console.log(`╚══════════════════════════════════════╝\n`);

  const ask = () => {
    rl.question("you › ", async (input) => {
      const message = input.trim();

      if (!message) {
        ask();
        return;
      }

      if (["exit", "quit", "bye"].includes(message.toLowerCase())) {
        console.log("\nGoodbye!\n");
        rl.close();
        process.exit(0);
      }

      process.stdout.write("\nassistant › ");
      try {
        await streamAgent(agent, message, threadId, (token) => {
          process.stdout.write(token);
        });
      } catch (err) {
        console.error("\n[error]", err);
      }
      console.log("\n");
      ask();
    });
  };

  rl.on("SIGINT", () => {
    console.log("\n\nGoodbye!\n");
    process.exit(0);
  });

  ask();
}

main().catch((err) => {
  console.error("[live-agent] Fatal error:", err);
  process.exit(1);
});
