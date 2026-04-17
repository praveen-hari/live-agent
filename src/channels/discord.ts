import {
  Client,
  GatewayIntentBits,
  Partials,
  type Message,
} from "discord.js";
import { type Config } from "../config/schema.js";
import { type LiveAgent, invokeAgent } from "../agent/core.js";

/**
 * Discord channel — uses discord.js to receive DMs and @mentions.
 *
 * Configure:
 *   config.channels.discord.enabled = true
 *   config.channels.discord.token = "<BOT_TOKEN>"
 *   config.channels.discord.guild_ids = ["..."]  (optional)
 *
 * The bot responds to:
 *   - Direct messages
 *   - @mentions in guild channels
 */
export function startDiscordChannel(config: Config, agent: LiveAgent): void {
  const { enabled, token, guild_ids } = config.channels.discord;
  if (!enabled || !token) return;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.once("ready", () => {
    console.log(`[discord] Logged in as ${client.user?.tag}`);
  });

  client.on("messageCreate", async (msg: Message) => {
    if (msg.author.bot) return;

    // Determine if we should respond
    const isDM = !msg.guild;
    const isMentioned = client.user && msg.mentions.has(client.user);
    if (!isDM && !isMentioned) return;

    // Guild filter
    if (msg.guild && guild_ids.length > 0 && !guild_ids.includes(msg.guild.id)) {
      return;
    }

    // Strip bot mention from message
    const content = msg.content
      .replace(/<@!?\d+>/g, "")
      .trim();

    if (!content) {
      await msg.reply("How can I help you?");
      return;
    }

    const threadId = `discord-${msg.author.id}`;
    console.log(`[discord] Message from ${msg.author.username}: ${content.slice(0, 80)}`);

    // Show typing indicator (not all channel types support this)
    if ("sendTyping" in msg.channel) {
      await (msg.channel as { sendTyping: () => Promise<void> }).sendTyping();
    }

    try {
      const reply = await invokeAgent(agent, content, threadId);
      // Discord max message length is 2000 chars
      const chunks = splitMessage(reply, 1990);
      for (const chunk of chunks) {
        await msg.reply(chunk);
      }
    } catch (err) {
      console.error("[discord] Error:", err);
      await msg.reply("Sorry, something went wrong. Please try again.");
    }
  });

  client.login(token).catch((err) => console.error("[discord] Login failed:", err));
}

function splitMessage(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLen) {
    chunks.push(text.slice(i, i + maxLen));
  }
  return chunks;
}
