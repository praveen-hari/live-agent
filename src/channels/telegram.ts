import { Bot, type Context } from "grammy";
import { type Config } from "../config/schema.js";
import { type LiveAgent, invokeAgent } from "../agent/core.js";

/**
 * Telegram channel — uses grammy to receive messages and forward to the agent.
 *
 * Configure:
 *   config.channels.telegram.enabled = true
 *   config.channels.telegram.token = "<BOT_TOKEN>"
 *   config.channels.telegram.allowed_user_ids = [123456789]  (optional)
 */
export function startTelegramChannel(config: Config, agent: LiveAgent): void {
  const { enabled, token, allowed_user_ids } = config.channels.telegram;
  if (!enabled || !token) return;

  const bot = new Bot(token);

  bot.use(async (ctx: Context, next) => {
    // Access control
    if (allowed_user_ids.length > 0) {
      const userId = ctx.from?.id;
      if (!userId || !allowed_user_ids.includes(userId)) {
        await ctx.reply("Unauthorised.");
        return;
      }
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    await ctx.reply(
      `Hi! I'm ${config.agent.name} — your personal assistant. Send me a message to get started.`,
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      `I can help with research, writing, scheduling, and more.\n\nJust send me a message!`,
    );
  });

  bot.on("message:text", async (ctx) => {
    const message = ctx.message.text;
    const threadId = `tg-${ctx.from?.id ?? "unknown"}`;

    console.log(`[telegram] Message from ${ctx.from?.username ?? ctx.from?.id}: ${message.slice(0, 80)}`);

    // Show typing indicator
    await ctx.replyWithChatAction("typing");

    try {
      const reply = await invokeAgent(agent, message, threadId);
      // Split long replies (Telegram max 4096 chars)
      const chunks = splitMessage(reply, 4096);
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: "Markdown" });
      }
    } catch (err) {
      console.error("[telegram] Error:", err);
      await ctx.reply("Sorry, something went wrong. Please try again.");
    }
  });

  bot.start({
    onStart: () => console.log("[telegram] Bot started"),
  }).catch((err) => console.error("[telegram] Fatal:", err));
}

function splitMessage(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLen) {
    chunks.push(text.slice(i, i + maxLen));
  }
  return chunks;
}
