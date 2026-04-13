# Yuna

**AI-powered multi-device orchestrator over Telegram.** Self-hosted.

Send a message from your phone. Claude on the server decides what to do — answer directly, or run commands on your devices. Devices are just hands. You pick the character.

```bash
npx yuna-bot init
```

That's it. The wizard walks you through Telegram, Anthropic, Upstash, and Vercel in about 5 minutes.

---

## How it works

```
Telegram message
      ↓
Vercel webhook (Claude Haiku + tool_use)
      ↓
Redis Streams (per-device command queue)
      ↓
Device agent (polls, executes, returns output)
      ↓
Result fed back to Claude → final answer → Telegram
```

- **Server**: Next.js on Vercel, calls the Claude API directly with native `tool_use`
- **Devices**: Lightweight Node.js agents that long-poll for commands and execute them
- **State**: Upstash Redis for conversation history, message queues, device registry
- **Auth**: Per-device UUID tokens, one-time setup codes, Telegram owner lock
- **Networking**: Outbound HTTPS only — no Tailscale, no VPN, no port forwarding

---

## Features

- **Dynamic device registry** — add or remove devices at runtime, tools generated on the fly
- **Agentic loops** — multi-step tool use, Claude can chain commands across devices
- **Per-device auth** — each device has its own revocable token
- **One-time setup codes** — no shared secrets during device onboarding
- **Device mesh** (optional) — configure SSH between devices, enable `transfer_file` tool for direct SCP
- **Model overrides** — `@opus`, `@sonnet`, `@haiku` prefix in your message picks the model
- **Emoji reactions** — 👍 proceed, 👎 stop, 🔄 retry, 🚀 ship it, ✅ confirm, ❌ cancel
- **Reply-to routing** — reply to a device message to continue that thread
- **Audit log** — every command + result logged to Redis, viewable via `/logs`
- **Rate limited** — built-in sliding window limiter
- **Prompt caching** — system prompt cached between invocations for cost efficiency

---

## Install

```bash
# Global install
npm install -g yuna-bot
yuna init

# Or one-shot
npx yuna-bot init
```

The init wizard will:

1. Ask for your bot's name (you pick — it's your character)
2. Open @BotFather for a Telegram bot token
3. Open console.anthropic.com for an API key
4. Open console.upstash.com for a Redis database
5. Deploy the server to your Vercel account (or scaffold for manual deploy)
6. Register the Telegram webhook
7. Save your local config

Then on each device:

```bash
# On the init machine, generate a setup code via Telegram
# Send /create-code to your bot → copy the code

# On the new device:
npm install -g yuna-bot
yuna add-device --code ABCD-1234 --url https://your-app.vercel.app
yuna start
```

Now you can message your bot from Telegram and it will execute commands on your registered devices.

---

## Commands

| Command | Description |
|---|---|
| `yuna init` | Deploy server, configure bot, wizard-guided setup |
| `yuna init --manual` | Scaffold server locally, you deploy manually |
| `yuna add-device --code X` | Register this machine as a device using a setup code |
| `yuna start` | Run the device agent (foreground) |
| `yuna status` | Show server health and device list |
| `yuna reset` | Clear conversation history |
| `yuna --help` | All commands |

Once set up, most operations happen via Telegram:

| Telegram command | What it does |
|---|---|
| `/start` | Show welcome message and commands |
| `/status` | Device list with online/offline status |
| `/reset` | Clear conversation history |
| `/create-code` | Generate a one-time device setup code |
| `/revoke <name>` | Revoke a device's token |
| `/logs` | Show recent audit log |

---

## Self-hosted

Yuna is 100% self-hosted. You deploy your own Vercel instance, use your own Anthropic API key, and use your own Upstash Redis database. Nothing is shared with anyone. There is no Yuna SaaS — there's just the code, and you run it.

### What you need

| Service | Why | Cost |
|---|---|---|
| [Telegram Bot](https://t.me/BotFather) | Your chat interface | Free |
| [Anthropic API](https://console.anthropic.com) | The brain (Claude Haiku by default) | Pay per token (~$0.001/msg) |
| [Upstash Redis](https://console.upstash.com) | Conversation history + device queues | Free tier: 10k commands/day |
| [Vercel](https://vercel.com) | Server hosting | Free tier: 100k function invocations/month |

Typical cost for personal use: **under $5/month** with Haiku, even heavy.

---

## Architecture

### Server (Next.js on Vercel)

```
server/
├── src/lib/
│   ├── redis.ts          # Upstash Redis client, streams, conversation, orchestration tasks, audit log
│   ├── devices.ts        # Device registry CRUD with online status
│   ├── auth.ts           # Per-device tokens, master secret, setup codes
│   ├── tools.ts          # Dynamic tool generation from device registry
│   ├── system-prompt.ts  # Dynamic system prompt per device
│   ├── orchestrator.ts   # Agentic loop with Claude API
│   ├── telegram.ts       # Telegram Bot API wrapper
│   └── rate-limit.ts     # Redis sliding window
└── src/app/api/
    ├── health/           # Redis health check
    ├── devices/          # Device list
    ├── relay/
    │   ├── poll/         # Device long-poll for commands
    │   ├── respond/      # Device posts command results
    │   └── register/     # Device registration via setup code
    └── telegram/
        ├── webhook/      # Telegram message handler
        └── setup/        # One-time webhook registration
```

### CLI + Agent (npm package)

```
src/
├── cli/                  # Commander-based CLI
│   ├── init.ts           # Interactive wizard
│   ├── add-device.ts     # Device registration
│   ├── start.ts          # Launch device agent
│   ├── status.ts         # Server + device status
│   └── helpers/          # Config, prompts, crypto, telegram, vercel, browser, api
└── agent/
    ├── agent.ts          # Polling loop with exponential backoff
    ├── executor.ts       # bash / read_file / write_file / transfer_file
    └── protocol.ts       # Wire protocol types
```

### Redis key schema

| Key | Type | Purpose |
|---|---|---|
| `yuna:devices` | SET | Registered device names |
| `yuna:device:{name}` | HASH | Device metadata (os, description, capabilities, ssh) |
| `yuna:token:{token}` | STRING | Per-device auth token → device identity |
| `yuna:device-token:{name}` | STRING | Reverse index for token revocation |
| `yuna:setup-code:{code}` | STRING | One-time device setup code (10min TTL) |
| `yuna:lastseen:{name}` | STRING | Device heartbeat timestamp |
| `yuna:stream:{name}` | STREAM | Per-device command queue (consumer group: `agent`) |
| `yuna:conversation:messages` | STRING | Shared conversation history (JSON) |
| `yuna:orchestration:{taskId}` | STRING | In-flight agentic task state (5min TTL) |
| `yuna:log` | LIST | Audit log, capped at 1000 entries |
| `yuna:master` | STRING | Hashed master secret |

---

## Security

- **No shared secrets between devices.** Each device has its own UUID token stored in Redis.
- **Token revocation** is instant — delete the Redis key.
- **One-time setup codes** (10min TTL, single-use) prevent token replay during registration.
- **Telegram webhook secret** prevents spoofed webhook calls.
- **Owner lock** — `TELEGRAM_OWNER_ID` restricts the bot to a single user.
- **Rate limiting** on the webhook prevents abuse.
- **Command execution** runs as the device agent's user (not root). Don't run the agent as root.
- **Outbound only** — devices never accept inbound connections.

---

## Development

```bash
git clone https://github.com/mikevitelli/yuna
cd yuna

# Install CLI deps
npm install

# Build CLI
npm run build:cli

# Run CLI from source
node bin/yuna.js --help

# Install server deps
cd server && npm install

# Run server locally
npm run dev

# Type check everything
npm run typecheck
```

See `PLAN.md` for the implementation roadmap and `CLAUDE.md` for the architecture guide that any Claude Code session can pick up from.

---

## Status

**v0.1 — Under active development.** Server and CLI are fully implemented and type-clean. End-to-end testing and npm publish are the next milestones. Not yet recommended for production use.

---

## License

MIT
