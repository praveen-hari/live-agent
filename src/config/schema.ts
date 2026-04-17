import { z } from "zod";

export const AgentConfigSchema = z.object({
  name: z.string().default("Live Agent"),
  system_prompt: z
    .string()
    .default(
      "You are a helpful personal assistant. You help with research, writing, scheduling, reminders, and day-to-day tasks.",
    ),
  model: z.string().default("anthropic:claude-sonnet-4-5-20250929"),
  max_tokens: z.number().int().positive().default(8192),
});

export const MemoryConfigSchema = z.object({
  backend: z.enum(["memory", "ephemeral"]).default("memory"),
  postgres_url: z.string().optional(),
});

export const GatewayConfigSchema = z.object({
  enabled: z.boolean().default(true),
  host: z.string().default("127.0.0.1"),
  port: z.number().int().positive().default(8080),
  secret: z.string().default("change-me"),
});

export const TelegramConfigSchema = z.object({
  enabled: z.boolean().default(false),
  token: z.string().default(""),
  allowed_user_ids: z.array(z.number()).default([]),
});

export const DiscordConfigSchema = z.object({
  enabled: z.boolean().default(false),
  token: z.string().default(""),
  guild_ids: z.array(z.string()).default([]),
});

export const ChannelsConfigSchema = z.object({
  telegram: TelegramConfigSchema.default({}),
  discord: DiscordConfigSchema.default({}),
});

export const WebSearchToolConfigSchema = z.object({
  enabled: z.boolean().default(true),
  tavily_api_key: z.string().default(""),
});

export const BrowserToolConfigSchema = z.object({
  enabled: z.boolean().default(true),
  headless: z.boolean().default(true),
});

export const NotificationsToolConfigSchema = z.object({
  enabled: z.boolean().default(true),
});

export const ToolsConfigSchema = z.object({
  web_search: WebSearchToolConfigSchema.default({}),
  browser: BrowserToolConfigSchema.default({}),
  notifications: NotificationsToolConfigSchema.default({}),
});

export const CronJobSchema = z.object({
  name: z.string(),
  schedule: z.string(),
  prompt: z.string(),
});

export const CronConfigSchema = z.object({
  enabled: z.boolean().default(true),
  jobs: z.array(CronJobSchema).default([]),
});

export const SecurityConfigSchema = z.object({
  interrupt_on: z.array(z.string()).default(["execute"]),
});

export const ObservabilityConfigSchema = z.object({
  langsmith_tracing: z.boolean().default(false),
});

export const ConfigSchema = z.object({
  agent: AgentConfigSchema.default({}),
  memory: MemoryConfigSchema.default({}),
  gateway: GatewayConfigSchema.default({}),
  channels: ChannelsConfigSchema.default({}),
  tools: ToolsConfigSchema.default({}),
  cron: CronConfigSchema.default({}),
  security: SecurityConfigSchema.default({}),
  observability: ObservabilityConfigSchema.default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type CronJob = z.infer<typeof CronJobSchema>;
