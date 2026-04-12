# Yuna

AI-powered multi-device orchestrator over Telegram. Self-hosted npm CLI + Vercel server.

## Architecture

- `server/` — Next.js 15 app deployed to Vercel. Calls Claude Haiku API with tool_use. Devices are stateless command executors.
- `src/cli/` — npm CLI (`yuna-bot`). Commands: init, add-device, start, status, reset.
- `src/agent/` — Node.js device agent. Polls server, executes bash/file commands, returns output.
- `src/shared/` — Types shared between CLI, agent, and server.

## Key design decisions

- **Per-device tokens**: Each device gets a unique auth token at registration. No shared secrets.
- **Dynamic N devices**: Tools and system prompt generated from Redis device registry. No hardcoded device names.
- **Server is the brain**: Claude runs on the server only. Devices never run Claude.
- **Conversation in Redis**: Single shared conversation history stored in Upstash Redis.
- **Redis Streams**: Command queues use Redis Streams with consumer groups and per-message ACK.

## Stack

- Next.js 15 (Vercel serverless)
- @anthropic-ai/sdk (Claude API)
- @upstash/redis (Redis REST)
- commander + inquirer (CLI)
- Telegram Bot API (webhooks)

## Conventions

- TypeScript strict mode
- `yuna:` Redis key prefix
- Server routes: `/api/relay/*` (device endpoints), `/api/telegram/*` (Telegram endpoints)
- Verify syntax: `npx tsc --noEmit` for .ts, `bash -n` for .sh
