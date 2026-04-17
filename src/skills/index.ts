/**
 * Skills registry for live-agent.
 *
 * A "skill" is a named block of instructions and optional tools that extend
 * the agent's behaviour for a specific domain. Skills are injected into
 * the agent's system prompt at startup.
 *
 * Deep Agents skills docs:
 * https://docs.langchain.com/oss/javascript/deepagents/skills
 */

export interface Skill {
  name: string;
  description: string;
  /** Instructions injected into the system prompt */
  instructions: string;
}

// ---------------------------------------------------------------------------
// Built-in skills
// ---------------------------------------------------------------------------

export const MORNING_BRIEFING_SKILL: Skill = {
  name: "morning-briefing",
  description: "Delivers a concise daily briefing when asked",
  instructions: `When the user asks for a morning briefing or daily summary:
1. Check today's date and day of the week
2. Search for top news headlines (use web_search)
3. Remind the user of any pending tasks you know about
4. Offer a productivity tip for the day
Keep the briefing under 300 words, structured and scannable.`,
};

export const TASK_TRACKER_SKILL: Skill = {
  name: "task-tracker",
  description: "Tracks tasks and todos across conversations",
  instructions: `When managing tasks:
- Store todos in /memories/tasks.json using write_file
- Always read /memories/tasks.json first to get current state
- Mark tasks as done, pending, or in-progress
- Remind the user of overdue tasks proactively
- Never delete tasks without explicit user confirmation`,
};

export const RESEARCH_SKILL: Skill = {
  name: "research",
  description: "Deep research with source citations",
  instructions: `When researching a topic:
1. Start with a broad web search to map the landscape
2. Identify the most authoritative sources
3. Dive deep using fetch_url on key pages
4. Synthesise findings with inline citations [Source: URL]
5. Flag any conflicting information
6. Always state what you could NOT find`,
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const SKILL_REGISTRY: Map<string, Skill> = new Map([
  ["morning-briefing", MORNING_BRIEFING_SKILL],
  ["task-tracker", TASK_TRACKER_SKILL],
  ["research", RESEARCH_SKILL],
]);

export function getSkill(name: string): Skill | undefined {
  return SKILL_REGISTRY.get(name);
}

export function listSkills(): Skill[] {
  return [...SKILL_REGISTRY.values()];
}

/**
 * Build the skills section of the system prompt from active skill names.
 */
export function buildSkillsPrompt(skillNames: string[]): string {
  if (skillNames.length === 0) return "";

  const blocks = skillNames
    .map((name) => {
      const skill = getSkill(name);
      if (!skill) return null;
      return `## Skill: ${skill.name}\n${skill.instructions}`;
    })
    .filter(Boolean);

  if (blocks.length === 0) return "";

  return `\n\n---\n# Loaded Skills\n\n${blocks.join("\n\n")}`;
}
