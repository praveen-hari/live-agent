/**
 * LoggingMiddleware — intercepts every model response and logs a summary.
 * Useful for debugging and observability without LangSmith.
 *
 * Deep Agents JS middleware docs:
 * https://docs.langchain.com/oss/javascript/deepagents/customization
 */
export class LoggingMiddleware {
  transformResponse(response: unknown): unknown {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messages = (response as any)?.messages;
      if (Array.isArray(messages) && messages.length > 0) {
        const last = messages[messages.length - 1];
        const preview = String(last?.content ?? "").slice(0, 120);
        console.log(`[agent] ← ${preview}${preview.length >= 120 ? "…" : ""}`);
      }
    } catch {
      // never throw from middleware
    }
    return response;
  }
}
