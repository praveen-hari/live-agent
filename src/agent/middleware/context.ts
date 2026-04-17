/**
 * UserContextMiddleware — injects user-specific context into the system prompt.
 *
 * Extend this to inject user preferences, timezone, locale, etc.
 * Deep Agents middleware: https://docs.langchain.com/oss/javascript/deepagents/customization
 */
export class UserContextMiddleware {
  private context: Record<string, unknown>;

  constructor(context: Record<string, unknown> = {}) {
    this.context = context;
  }

  get systemPrompt(): string {
    const lines: string[] = [];
    const now = new Date().toLocaleString("en-US", {
      timeZoneName: "short",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    lines.push(`Current date/time: ${now}`);

    for (const [key, value] of Object.entries(this.context)) {
      lines.push(`${key}: ${String(value)}`);
    }

    return lines.join("\n");
  }

  transformRequest(request: unknown): unknown {
    return request;
  }
}
