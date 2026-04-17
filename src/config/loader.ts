import fs from "fs";
import path from "path";
import * as TOML from "@iarna/toml";
import "dotenv/config";
import { ConfigSchema, type Config } from "./schema.js";

/**
 * Resolves config in priority order:
 *   1. Environment variables (LIVE_AGENT_CONFIG_PATH)
 *   2. ./config.toml in cwd
 *   3. ~/.config/live-agent/config.toml
 *   4. Built-in defaults
 */
function resolveConfigPath(): string | null {
  const envPath = process.env["LIVE_AGENT_CONFIG_PATH"];
  if (envPath && fs.existsSync(envPath)) return envPath;

  const cwdPath = path.join(process.cwd(), "config.toml");
  if (fs.existsSync(cwdPath)) return cwdPath;

  const homePath = path.join(
    process.env["HOME"] ?? "~",
    ".config",
    "live-agent",
    "config.toml",
  );
  if (fs.existsSync(homePath)) return homePath;

  return null;
}

/**
 * Override config fields with environment variables:
 *   ANTHROPIC_API_KEY, OPENAI_API_KEY, TAVILY_API_KEY,
 *   TELEGRAM_BOT_TOKEN, DISCORD_BOT_TOKEN, etc.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyEnvOverrides(raw: any): any {
  const env = process.env;

  if (env["TAVILY_API_KEY"]) {
    raw.tools = raw.tools ?? {};
    raw.tools.web_search = raw.tools.web_search ?? {};
    raw.tools.web_search.tavily_api_key = env["TAVILY_API_KEY"];
  }
  if (env["TELEGRAM_BOT_TOKEN"]) {
    raw.channels = raw.channels ?? {};
    raw.channels.telegram = raw.channels.telegram ?? {};
    raw.channels.telegram.token = env["TELEGRAM_BOT_TOKEN"];
    raw.channels.telegram.enabled = true;
  }
  if (env["DISCORD_BOT_TOKEN"]) {
    raw.channels = raw.channels ?? {};
    raw.channels.discord = raw.channels.discord ?? {};
    raw.channels.discord.token = env["DISCORD_BOT_TOKEN"];
    raw.channels.discord.enabled = true;
  }
  if (env["GATEWAY_SECRET"]) {
    raw.gateway = raw.gateway ?? {};
    raw.gateway.secret = env["GATEWAY_SECRET"];
  }
  if (env["AGENT_MODEL"]) {
    raw.agent = raw.agent ?? {};
    raw.agent.model = env["AGENT_MODEL"];
  }
  if (env["LANGSMITH_TRACING"] === "true") {
    raw.observability = raw.observability ?? {};
    raw.observability.langsmith_tracing = true;
  }

  return raw;
}

let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config) return _config;

  const configPath = resolveConfigPath();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let raw: any = {};

  if (configPath) {
    const content = fs.readFileSync(configPath, "utf-8");
    raw = TOML.parse(content);
    console.log(`[config] Loaded from ${configPath}`);
  } else {
    console.log("[config] No config.toml found — using defaults + env vars");
  }

  raw = applyEnvOverrides(raw);
  _config = ConfigSchema.parse(raw);
  return _config;
}
