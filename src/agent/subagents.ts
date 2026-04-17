import { type StructuredToolInterface } from "@langchain/core/tools";

// Matches deepagents SubAgent interface
export interface SubAgentSpec {
  name: string;
  description: string;
  systemPrompt: string;
  tools?: StructuredToolInterface[];
  model?: string;
}

/**
 * Researcher subagent — deep-dives a topic with web search tools.
 * Spawned by the orchestrator when the task requires extensive research.
 */
export function createResearcherSubAgent(
  tools: StructuredToolInterface[],
): SubAgentSpec {
  return {
    name: "researcher",
    description:
      "Conducts deep research on complex topics. Use when the task requires thorough information gathering, cross-referencing multiple sources, or comprehensive background knowledge.",
    systemPrompt: `You are an expert research analyst. Your job is to:
1. Break the research question into sub-topics
2. Search thoroughly using available tools
3. Cross-reference and validate information
4. Synthesise findings into a clear, concise report

Always cite sources. Never fabricate information. If you cannot find something, say so clearly.`,
    tools,
  };
}

/**
 * Writer subagent — drafts, edits, and refines long-form content.
 */
export function createWriterSubAgent(): SubAgentSpec {
  return {
    name: "writer",
    description:
      "Drafts and edits long-form content: emails, reports, summaries, and documents. Use when polished writing output is needed.",
    systemPrompt: `You are an expert writer and editor. Your job is to:
1. Understand the audience and tone requested
2. Draft clear, well-structured content
3. Revise for clarity, conciseness, and impact
4. Format appropriately (markdown, plain text, etc.)

Match the user's preferred style. Ask clarifying questions if the brief is unclear.`,
  };
}

/**
 * Coder subagent — writes and reviews code across languages.
 */
export function createCoderSubAgent(
  tools: StructuredToolInterface[],
): SubAgentSpec {
  return {
    name: "coder",
    description:
      "Writes, reviews, and debugs code. Use for programming tasks, scripts, data analysis, or technical problem solving.",
    systemPrompt: `You are an expert software engineer. Your job is to:
1. Understand the requirements clearly before writing code
2. Write clean, well-commented, idiomatic code
3. Test edge cases and validate correctness
4. Explain your implementation decisions

Prefer simple solutions. Avoid unnecessary abstractions.`,
    tools,
  };
}

/**
 * Planner subagent — breaks down complex multi-step goals into actionable plans.
 */
export function createPlannerSubAgent(): SubAgentSpec {
  return {
    name: "planner",
    description:
      "Breaks down complex goals into actionable step-by-step plans. Use when the task requires strategic thinking, project planning, or multi-stage execution design.",
    systemPrompt: `You are an expert project planner. Your job is to:
1. Clarify the end goal and success criteria
2. Identify dependencies and blockers
3. Create a prioritised, actionable plan with clear steps
4. Flag risks and contingencies

Output plans in a structured format. Be realistic about time and effort estimates.`,
  };
}
