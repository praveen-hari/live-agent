import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { type Config } from "../config/schema.js";

/**
 * Creates a Playwright-backed browser tool for headless web automation.
 * The browser instance is lazily initialised on first use.
 */
export function createBrowserTool(config: Config) {
  if (!config.tools.browser.enabled) return null;

  const headless = config.tools.browser.headless;

  return tool(
    async ({ url, action, selector, text }: {
      url?: string;
      action: "navigate" | "screenshot" | "click" | "type" | "extract_text";
      selector?: string;
      text?: string;
    }) => {
      // Dynamic import so playwright is optional at startup
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless });
      const page = await browser.newPage();

      try {
        if (url) await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

        switch (action) {
          case "navigate":
            return `Navigated to ${url}`;
          case "extract_text": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const bodyText = await page.evaluate(() => (globalThis as any).document.body.innerText as string);
            return String(bodyText).slice(0, 8_000);
          }
          case "click":
            if (!selector) return "Error: selector required for click";
            await page.click(selector);
            return `Clicked ${selector}`;
          case "type":
            if (!selector || !text) return "Error: selector and text required for type";
            await page.fill(selector, text);
            return `Typed into ${selector}`;
          case "screenshot": {
            const buf = await page.screenshot({ type: "png" });
            return `[Screenshot captured — ${buf.length} bytes (base64 not returned in text mode)]`;
          }
          default:
            return `Unknown action: ${action}`;
        }
      } finally {
        await browser.close();
      }
    },
    {
      name: "browser",
      description:
        "Control a headless browser. Navigate to URLs, click elements, type text, or extract page text. Use for tasks requiring JavaScript-rendered content.",
      schema: z.object({
        url: z.string().url().optional().describe("URL to navigate to"),
        action: z
          .enum(["navigate", "screenshot", "click", "type", "extract_text"])
          .describe("Action to perform"),
        selector: z
          .string()
          .optional()
          .describe("CSS selector for click/type actions"),
        text: z
          .string()
          .optional()
          .describe("Text to type (for type action)"),
      }),
    },
  );
}
