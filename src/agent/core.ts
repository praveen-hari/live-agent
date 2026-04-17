import {
  createDeepAgent,
  CompositeBackend,
  StateBackend,
  StoreBackend,
} from "deepagents";
import { MemorySaver } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
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

  // ── Checkpointer (per-agent instance for thread-level memory) ────────────
  const checkpointer = new MemorySaver();

  // Strip provider prefix (e.g. "anthropic:") — ChatAnthropic takes the model name only
  const modelName = config.agent.model.includes(":")
    ? config.agent.model.split(":").slice(1).join(":")
    : config.agent.model;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelInstance = new ChatAnthropic({ model: modelName }) as any;

  // ── Assemble agent ───────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agent = createDeepAgent({
    model: modelInstance,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: tools as any[],
    systemPrompt,
    subagents,
    backend,
    checkpointer,
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
 * Uses streamEvents("on_chat_model_stream") for real incremental token delivery.
 * Returns the final message list from the checkpointer after streaming.
 */
export async function streamAgent(
  agent: LiveAgent,
  message: string,
  threadId: string,
  onToken: (token: string) => void,
): Promise<MessageDict[]> {
  const config = { configurable: { thread_id: threadId } };

  // streamEvents gives true token-level streaming via on_chat_model_stream events.
  // agent.stream() with streamMode:"messages" yields whole message chunks, not
  // individual tokens, and content arrives as arrays not strings — so we use
  // streamEvents instead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventStream = (agent as any).streamEvents(
    { messages: [{ role: "user", content: message }] },
    { ...config, version: "v2" },
  );

  for await (const ev of eventStream) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = ev as any;
    if (event.event === "on_chat_model_stream") {
      const chunk = event.data?.chunk;
      const content = chunk?.content;
      let token = "";
      if (typeof content === "string") {
        token = content;
      } else if (Array.isArray(content)) {
        // Claude returns content as [{type:"text", text:"..."}] blocks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token = content
          .filter((c: unknown) => typeof c === "string" || (c as any)?.type === "text")
          .map((c: unknown) => (typeof c === "string" ? c : (c as any)?.text ?? ""))
          .join("");
      }
      if (token) {
        onToken(token);
      }
    }
  }

  // After streaming, retrieve the full conversation state from the checkpointer
  return getAgentMessages(agent, threadId);
}

/** Plain message dict for SSE serialisation */
export interface MessageDict {
  id: string;
  type: "human" | "ai" | "system" | "tool";
  content: string;
  /** Present on ai messages that invoke tools */
  tool_calls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  /** Present on tool messages — links back to the tool_call that triggered this result */
  tool_call_id?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  additional_kwargs?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response_metadata?: Record<string, any>;
}

/**
 * Retrieve the current message list for a thread from the agent's checkpointer.
 */
export async function getAgentMessages(
  agent: LiveAgent,
  threadId: string,
): Promise<MessageDict[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = await (agent as any).getState({ configurable: { thread_id: threadId } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMessages: any[] = state?.values?.messages ?? [];
    return rawMessages.map((m, i): MessageDict => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = m as any;
      const type = raw._getType?.() ?? raw.type ?? raw.role ?? "ai";
      const normType: MessageDict["type"] =
        type === "human" || type === "user" ? "human"
        : type === "ai" || type === "assistant" ? "ai"
        : type === "system" ? "system"
        : type === "tool" ? "tool"
        : "ai";
      const content =
        typeof raw.content === "string"
          ? raw.content
          : Array.isArray(raw.content)
            ? raw.content
                .map((c: unknown) =>
                  typeof c === "string" ? c : (c as { text?: string })?.text ?? "",
                )
                .join("")
            : "";
      // Extract tool_calls from AI messages
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> | undefined =
        normType === "ai" && Array.isArray(raw.tool_calls) && raw.tool_calls.length > 0
          ? raw.tool_calls
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((tc: any) => tc.name && tc.name !== "")
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((tc: any) => ({
                id: tc.id ?? `tc-${i}-${Math.random().toString(36).slice(2, 7)}`,
                name: tc.name ?? "unknown",
                args: (tc.args ?? tc.input ?? {}) as Record<string, unknown>,
              }))
          : undefined;
      return {
        id: raw.id ?? `msg-${i}`,
        type: normType,
        content,
        ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        ...(normType === "tool" && raw.tool_call_id ? { tool_call_id: String(raw.tool_call_id) } : {}),
        additional_kwargs: raw.additional_kwargs ?? {},
        response_metadata: raw.response_metadata ?? {},
      };
    });
  } catch {
    return [];
  }
}
