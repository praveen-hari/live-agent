import {
  createDeepAgent,
  CompositeBackend,
  StateBackend,
  StoreBackend,
} from "deepagents";
import { type StructuredTool } from "@langchain/core/tools";

import { type Config } from "../config/schema.js";
import { type MemoryStore } from "../memory/store.js";
import { buildInterruptMap } from "../security/policy.js";
import { buildSkillsPrompt, listSkills } from "../skills/index.js";
import { UserContextMiddleware } from "./middleware/context.js";
import {
  createResearcherSubAgent,
  createWriterSubAgent,
  createCoderSubAgent,
  createPlannerSubAgent,
} from "./subagents.js";

export interface AgentOptions {
  config: Config;
  store: MemoryStore;
  tools?: StructuredTool[];
  /** User context key/value pairs injected into system prompt */
  userContext?: Record<string, unknown>;
  /** Skill names to load (default: all built-in skills) */
  skills?: string[];
}

/**
 * Creates and returns the live-agent deep agent instance.
 *
 * The agent is a compiled LangGraph StateGraph with:
 *   - CompositeBackend: /memories/ → StoreBackend, workspace → StateBackend
 *   - MemorySaver checkpointer for conversation persistence
 *   - Researcher, Writer, Coder, Planner subagents
 *   - UserContextMiddleware for date/time injection
 *   - interrupt_on for sensitive tools (from config.security)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLiveAgent(options: AgentOptions): any {
  const { config, store, tools = [], userContext = {} } = options;

  // ── System prompt ──────────────────────────────────────────────────────────
  const skillNames = options.skills ?? listSkills().map((s) => s.name);
  const skillsPrompt = buildSkillsPrompt(skillNames);
  const contextMiddleware = new UserContextMiddleware(userContext);
  const systemPrompt =
    `${config.agent.system_prompt}${skillsPrompt}\n\n${contextMiddleware.systemPrompt}`;

  // ── Subagents ──────────────────────────────────────────────────────────────
  const researchTools = tools.filter((t) =>
    ["tavily_search_results_json", "fetch_url"].includes(t.name),
  );
  const codeTools = tools.filter((t) => t.name === "execute");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subagents: any[] = [
    createResearcherSubAgent(researchTools as any[]),
    createWriterSubAgent(),
    createCoderSubAgent(codeTools as any[]),
    createPlannerSubAgent(),
  ];

  // ── Backend ────────────────────────────────────────────────────────────────
  const backend = new CompositeBackend(new StateBackend(), {
    "/memories/": new StoreBackend(),
  });

  // ── Interrupt map ──────────────────────────────────────────────────────────
  const interruptOn = buildInterruptMap(config);

  // ── Assemble agent ─────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agent = createDeepAgent({
    // Pass model name as string — deepagents resolves it via init_chat_model
    model: config.agent.model,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: tools as any[],
    systemPrompt,
    subagents,
    backend,
    // true = deepagents uses its own internal MemorySaver (avoids version mismatch)
    checkpointer: true,
    store,
    interruptOn,
  });

  console.log(
    `[agent] ${config.agent.name} ready (model: ${config.agent.model}, skills: ${skillNames.join(", ")})`,
  );

  return agent;
}

// ── Convenience: invoke with thread ID ────────────────────────────────────

export type LiveAgent = ReturnType<typeof createLiveAgent>;

export async function invokeAgent(
  agent: LiveAgent,
  message: string,
  threadId: string,
): Promise<string> {
  const config = { configurable: { thread_id: threadId } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await agent.invoke(
    { messages: [{ role: "user", content: message }] } as any,
    config as any,
  ) as any;

  // Extract last assistant message
  const messages: unknown[] = result?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = messages[i] as any;
    const msgType: string = msg?._getType?.() ?? msg?.role ?? "";
    if (msgType === "ai" || msgType === "assistant") {
      const content = msg.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content
          .filter((c: unknown) => typeof c === "string" || (c as any)?.type === "text")
          .map((c: unknown) => (typeof c === "string" ? c : (c as any).text))
          .join("");
      }
    }
  }

  return "(no response)";
}

/**
 * Stream agent response token-by-token, calling onToken for each chunk.
 */
export async function streamAgent(
  agent: LiveAgent,
  message: string,
  threadId: string,
  onToken: (token: string) => void,
): Promise<void> {
  const config = { configurable: { thread_id: threadId } };

  // stream() may return a Promise<AsyncIterable> — resolve it first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await (agent as any).stream(
    { messages: [{ role: "user", content: message }] },
    { ...config, streamMode: "messages" },
  );

  for await (const chunk of stream) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content = (chunk as any)?.content;
    if (typeof content === "string" && content) {
      onToken(content);
    }
  }
}
