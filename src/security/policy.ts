import { type Config } from "../config/schema.js";

export type InterruptMap = Record<string, boolean>;

/**
 * Builds the interrupt_on map for createDeepAgent from config.
 * Tools listed in config.security.interrupt_on require human approval
 * before execution (uses LangGraph's interrupt mechanism).
 */
export function buildInterruptMap(config: Config): InterruptMap {
  const map: InterruptMap = {};
  for (const toolName of config.security.interrupt_on) {
    map[toolName] = true;
  }
  return map;
}

/**
 * Filesystem permission rules for the deep agent.
 * Restricts which paths the agent can read or write.
 *
 * See: https://docs.langchain.com/oss/javascript/deepagents/permissions
 */
export function buildPermissionRules(workspaceRoot: string) {
  return [
    // Allow read/write only within the workspace directory
    { type: "allow" as const, path: workspaceRoot, operations: ["read", "write"] },
    // Allow read-only access to /memories/ virtual path
    { type: "allow" as const, path: "/memories/", operations: ["read", "write"] },
    // Deny access to sensitive system paths
    { type: "deny" as const, path: "/etc/", operations: ["read", "write"] },
    { type: "deny" as const, path: "/root/", operations: ["read", "write"] },
  ];
}
