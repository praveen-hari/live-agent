import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { type Config } from "../config/schema.js";

/**
 * Desktop notification tool — sends OS-level notifications via node-notifier.
 */
export function createNotificationTool(config: Config) {
  if (!config.tools.notifications.enabled) return null;

  return tool(
    async ({ title, message, sound }: {
      title: string;
      message: string;
      sound?: boolean;
    }) => {
      const notifier = await import("node-notifier");
      notifier.default.notify({
        title,
        message,
        sound: sound ?? false,
        icon: undefined,
      });
      return `Notification sent: "${title}" — ${message}`;
    },
    {
      name: "notify",
      description:
        "Send a desktop notification to the user. Use for reminders, alerts, or task completions.",
      schema: z.object({
        title: z.string().describe("Notification title"),
        message: z.string().describe("Notification body"),
        sound: z.boolean().optional().describe("Play notification sound"),
      }),
    },
  );
}
