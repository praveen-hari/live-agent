# live-agent

Your own personal assistant agent — built on [Deep Agents](https://docs.langchain.com/oss/javascript/deepagents/overview) + LangChain/LangGraph.

## Features

- **Multi-step task planning** via built-in Deep Agents `write_todos`
- **Web search** (Tavily) + headless browser (Playwright)
- **Long-term memory** across conversations (LangGraph MemoryStore)
- **Subagents**: researcher, writer, coder, planner
- **Skills**: morning briefing, task tracker, research
- **Channels**: Telegram bot, Discord bot, HTTP/WebSocket gateway
- **Cron jobs**: scheduled proactive agent invocations
- **Human-in-the-loop**: approval gates for sensitive tools
- **LangSmith tracing** support

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure
cp .env.example .env        # add your API keys
cp config.example.toml config.toml   # optional: customise

# 3. Run interactive REPL
npm run dev

# 4. One-shot query
npx tsx src/index.ts "What's the latest news in AI?"

# 5. Server mode (gateway + channels)
npx tsx src/index.ts --serve
```

## Configuration

| Method | Priority |
|---|---|
| `LIVE_AGENT_CONFIG_PATH` env var | Highest |
| `./config.toml` in cwd | Second |
| `~/.config/live-agent/config.toml` | Third |
| Defaults + env vars | Fallback |

Key environment variables:
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` — LLM provider
- `TAVILY_API_KEY` — web search
- `TELEGRAM_BOT_TOKEN` — Telegram channel
- `DISCORD_BOT_TOKEN` — Discord channel
- `LANGSMITH_TRACING=true` + `LANGSMITH_API_KEY` — observability

## Architecture

```
src/
├── index.ts              CLI entrypoint (REPL / one-shot / --serve)
├── agent/
│   ├── core.ts           createDeepAgent wiring
│   ├── subagents.ts      researcher, writer, coder, planner
│   └── middleware/       context injection, logging
├── tools/                web-search, browser, notifications
├── channels/             gateway (HTTP/WS), telegram, discord
├── memory/               LangGraph store setup
├── cron/                 node-cron scheduler
├── skills/               built-in skill registry
├── security/             interrupt map, filesystem permissions
└── config/               Zod schema + TOML loader
```

## Scripts

```bash
npm run dev        # tsx watch — hot reload
npm run build      # compile to dist/
npm run start      # run compiled dist/index.js
npm run typecheck  # tsc --noEmit
```
