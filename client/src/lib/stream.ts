import { FetchStreamTransport } from "@langchain/react";

/**
 * Single FetchStreamTransport instance used by useStream across the app.
 * Posts to /stream which is proxied by Vite to http://localhost:8080/stream.
 *
 * The backend endpoint accepts:
 *   POST /stream
 *   { input: { messages }, config: { configurable: { thread_id } } }
 *
 * And responds with SSE events:
 *   metadata → messages (AIMessageChunk tuples) → values (full state)
 */
export const agentTransport = new FetchStreamTransport({
  apiUrl: "/stream",
});
