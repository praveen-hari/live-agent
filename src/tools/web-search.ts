import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { type Config } from "../config/schema.js";

/**
 * Creates the web search tool using Tavily.
 * Requires TAVILY_API_KEY in env or config.tools.web_search.tavily_api_key.
 */
export function createWebSearchTool(config: Config) {
  const apiKey =
    config.tools.web_search.tavily_api_key || process.env["TAVILY_API_KEY"];

  if (!apiKey) {
    console.warn(
      "[tools/web-search] TAVILY_API_KEY not set — web search disabled",
    );
    return null;
  }

  return new TavilySearchResults({
    maxResults: 5,
    apiKey,
  });
}

/**
 * A lightweight URL fetch tool for reading a specific web page.
 */
export const fetchUrlTool = tool(
  async ({ url }: { url: string }) => {
    const res = await fetch(url, {
      headers: { "User-Agent": "live-agent/0.1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return `Error fetching ${url}: HTTP ${res.status}`;
    }
    const text = await res.text();
    // Return first 8000 chars to stay within context budget
    return text.slice(0, 8_000);
  },
  {
    name: "fetch_url",
    description:
      "Fetch the content of a web page by URL. Returns raw text (HTML stripped by the model).",
    schema: z.object({
      url: z.string().url().describe("The URL to fetch"),
    }),
  },
);
