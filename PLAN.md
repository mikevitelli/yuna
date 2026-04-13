# Plan: Yuna — Self-Hosted AI Device Orchestrator

## Context

Shiny Politoed works but is hardcoded to Mike's 2 devices. Yuna is the generic, distributable product: an npm CLI that lets anyone self-host the same architecture with their own devices, bot character, and API keys. New repo, new npm package, same engine.

## Product

- **npm**: `yuna-bot` (`npx yuna-bot init`)
- **CLI command**: `yuna`
- **Domain**: `yuna.bot`
- **Repo**: `mikevitelli/yuna`
- **Tagline**: "AI-powered multi-device orchestrator over Telegram"

## User flow

```
npx yuna-bot init         → wizard: bot name, Telegram token, Anthropic key, Redis, deploy to Vercel
yuna add-device           → register a device (name, OS, description)
yuna start                → run device agent on this machine
yuna status               → show server health + device online/offline
yuna reset                → clear conversation history
```

## Repo structure

```
yuna/
├── package.json              # npm: "yuna-bot", bin: { "yuna": "./bin/yuna.js" }
├── bin/yuna.js               # shim → dist/cli/index.js
├── src/
│   ├── cli/
│   │   ├── index.ts          # commander entry
│   │   ├── init.ts           # wizard: deploy server, configure everything
│   │   ├── add-device.ts     # register device with server
│   │   ├── start.ts          # run device agent
│   │   ├── status.ts         # ping server, list devices
│   │   ├── reset.ts          # clear conversation
│   │   └── helpers/
│   │       ├── config.ts     # ~/.config/yuna/{config,device}.json
│   │       ├── prompts.ts    # inquirer wrappers
│   │       ├── vercel.ts     # vercel deploy automation
│   │       ├── telegram.ts   # bot token validation + webhook setup
│   │       ├── crypto.ts     # secret generation
│   │       └── browser.ts    # open URLs in browser (cross-platform)
│   ├── agent/
│   │   ├── agent.ts          # Node.js polling loop (replaces relay-agent.sh)
│   │   ├── executor.ts       # bash/read_file/write_file execution
│   │   └── protocol.ts       # wire protocol types
│   └── shared/
│       └── types.ts          # DeviceConfig, WireCommand, etc.
└── server/                   # Next.js Vercel app (deployed by user)
    └── (same structure as current, refactored for dynamic devices)
```

## Security: Per-device tokens

No shared secrets. Each device gets its own token at registration.

**Flow:**
1. `yuna init` generates a `MASTER_SECRET` (stored in Vercel env + local config)
2. `yuna add-device` on a new machine:
   - User provides the master secret (one-time, during setup)
   - Server generates a unique device token (UUID), stores `yuna:token:{token} → {device, registeredAt}`
   - Device stores its token locally in `~/.config/yuna/device.json`
   - Device uses its unique token for all subsequent poll/respond requests
3. Server validates: `Authorization: Bearer {deviceToken}` → looks up `yuna:token:{token}` → gets device identity
4. Revoking a device: delete its token from Redis. Other devices unaffected.
5. `TELEGRAM_OWNER_ID` still locks Telegram to one user
6. Telegram webhook still verified via `TELEGRAM_WEBHOOK_SECRET` header

**Redis keys for auth:**
```
yuna:token:{token}          → STRING { device, registeredAt } (per-device auth)
yuna:master                 → STRING (hashed master secret, for device registration only)
```

**No Tailscale required.** Devices make outbound HTTPS to the public Vercel URL. No inbound connections, no port forwarding, no VPN. Works from any network.

## Key architecture change: Dynamic N devices

**Current**: 2 hardcoded devices in tools.ts, system-prompt.ts, redis.ts
**New**: Device registry in Redis, everything generated dynamically

### Device registry (Redis)
```
yuna:devices                → SET of device names
yuna:device:{name}          → HASH { os, description, capabilities, registeredAt }
yuna:token:{token}          → STRING { device, registeredAt }
yuna:lastseen:{name}        → STRING (ISO timestamp)
yuna:stream:{name}          → STREAM (command queue)
yuna:conversation:messages  → STRING (shared conversation JSON)
yuna:orchestration:{taskId} → STRING (in-flight task JSON)
```

### Dynamic tool generation
`buildDeviceTools()` reads device registry, generates:
- `run_on_{deviceName}` tool per device
- `read_file` + `write_file` with dynamic device enum
- `toolToDevice()` mapping derived from device list

### Dynamic system prompt
`buildSystemPrompt()` reads device registry, builds a device section per registered device with its OS, description, capabilities, and online/offline status.

## What's copied from shiny-politoed vs written fresh

### Copied unchanged (6 files)
- `server/src/lib/rate-limit.ts`
- `server/src/lib/telegram.ts`
- `server/src/app/api/health/route.ts`
- `server/src/app/api/relay/poll/route.ts`
- `server/src/app/api/relay/respond/route.ts`
- `server/src/app/api/telegram/setup/route.ts`

### Modified from prototype (8 files)
- `server/src/lib/auth.ts` — per-device token validation (lookup token → device identity in Redis)
- `server/src/lib/tools.ts` — dynamic tool generation from registry
- `server/src/lib/system-prompt.ts` — dynamic device sections from registry
- `server/src/lib/orchestrator.ts` — async tools, no hardcoded fallback
- `server/src/lib/redis.ts` — remove DEVICE_LABELS, rename prefix to `yuna:`
- `server/src/app/api/relay/register/route.ts` — accept metadata, issue per-device token
- `server/src/app/api/telegram/webhook/route.ts` — dynamic help text, device list
- `server/src/app/page.tsx` + `layout.tsx` — generic branding from env vars

### Written fresh (~18 files)
- All `src/cli/` files (init wizard, commands, helpers)
- All `src/agent/` files (Node.js device agent)
- `src/shared/types.ts`
- `server/src/lib/devices.ts` — device registry CRUD
- `server/src/app/api/devices/route.ts` — device list endpoint
- Root `package.json`, `tsconfig.json`, `bin/yuna.js`

## Init wizard flow

Two modes: `yuna init` (standalone CLI) and `yuna init --mcp` (from Claude Code with MCP integrations).

### Standalone mode (`yuna init`)
Guided wizard that opens browser links and validates each step:

1. Welcome banner
2. "Bot name?" → default "Yuna"
3. "Your name?" → default from `git config user.name`
4. **Telegram setup** (guided):
   - "Do you have a Telegram bot token?" → yes/no
   - If no: opens https://t.me/BotFather in browser, prints instructions
   - "Paste your bot token:" → validate via `getMe` API, show bot username
   - "Your Telegram user ID (get from @userinfobot):" → validate format
5. **Anthropic API key** (guided):
   - "Do you have an Anthropic API key?" → yes/no
   - If no: opens https://console.anthropic.com/settings/keys in browser
   - "Paste your API key:" → validate format (`sk-ant-...`)
6. **Redis** (guided):
   - "Do you have an Upstash Redis database?" → yes/no
   - If no: opens https://console.upstash.com in browser, prints "Create a free database, copy the REST URL and token"
   - "REST URL:" → validate format
   - "REST Token:" → test connection with ping
7. Generate MASTER_SECRET + TELEGRAM_WEBHOOK_SECRET
8. **Deploy** (choice):
   - "Deploy to Vercel now?" → yes (runs `vercel deploy`) / no (`--manual` scaffold)
   - If yes: check `vercel` CLI installed, run `vercel login` if needed, deploy, set env vars
   - If no: copy server/ to `./yuna-server/`, write `.env` with all values, print manual instructions
9. Store hashed MASTER_SECRET in Redis
10. Register Telegram webhook
11. Write `~/.config/yuna/config.json`
12. Print success + next steps

### MCP mode (`yuna init --mcp`)
For users running setup from Claude Code. Outputs a CLAUDE.md-compatible instruction block that Claude Code can execute using MCP tools:

1. Same prompts for bot name, owner name
2. **Telegram**: same manual flow (no MCP for BotFather)
3. **Anthropic**: same manual flow (user pastes key)
4. **Redis**: if Upstash MCP is connected, auto-create database via MCP. Otherwise guided.
5. **Deploy**: if Vercel MCP is connected, deploy via MCP. Otherwise guided CLI.
6. Same secret generation, webhook registration, config write

The `--mcp` flag detects available MCP servers and uses them where possible, falls back to guided prompts where not.

## Add-device flow

1. Load `~/.config/yuna/config.json` (needs serverUrl + masterSecret)
2. "Device name?" → e.g. "laptop", "raspberry-pi"
3. "OS?" → Linux / macOS / Windows
4. "Description?" → free-form
5. POST to `/api/relay/register` with masterSecret + device info
6. Server validates masterSecret, generates unique device token (UUID)
7. Server stores device metadata + token in Redis
8. Server returns device token
9. Write `~/.config/yuna/device.json` (serverUrl + deviceToken + deviceName)
10. "Device registered. Run `yuna start` to begin listening."

## CLI dependencies
- `commander` — subcommands
- `inquirer` — interactive prompts
- `chalk` — colored output
- `ora` — spinners

## Audit findings (from shiny-politoed diff)

All "copied" files import `validateDeviceSecret()` which uses a single shared secret.
In Yuna, ALL route files need the new per-device token auth. Nothing is truly "copy unchanged".

Correct categorization:
- **rate-limit.ts, telegram.ts** — truly generic, copy as-is
- **health/route.ts** — copy as-is (no auth)
- **poll, respond, setup, register routes** — need auth import change (per-device tokens)
- **Everything else** — rewrite

Redis keys: 7 locations in redis.ts use `relay:` prefix, all need `yuna:`.
Stream consumer group: currently `"relay"`, plan says `"agent"`.

Wire protocol (server↔device) is implemented but not documented in plan. Adding here:

### Wire protocol

**Server → Device** (in Redis stream `yuna:stream:{name}`):
```json
{
  "type": "command",
  "taskId": "uuid",
  "tool": "run_on_{deviceName}|read_file|write_file",
  "input": { "command": "...", "working_directory": "...", "timeout_seconds": 30 }
}
```

**Device → Server** (POST `/api/relay/respond`):
```json
{
  "device": "laptop",
  "taskId": "uuid",
  "output": "command stdout+stderr",
  "exitCode": 0,
  "streamId": "redis-stream-id"
}
```

## Implementation phases

### Phase 1: Server foundation (dependency order matters)
Repo already created (`mikevitelli/yuna`).
1. Scaffold `server/` — package.json, tsconfig, next.config.ts
2. `server/src/lib/redis.ts` — Redis client, `yuna:` prefix, stream helpers, conversation, orchestration (port from prototype, rename all keys)
3. `server/src/lib/devices.ts` — **BLOCKER**: device registry CRUD, all other modules depend on this
4. `server/src/lib/auth.ts` — per-device token lookup (`yuna:token:{token}` → device), master secret validation (`yuna:master`)
5. `server/src/lib/rate-limit.ts` — copy as-is
6. `server/src/lib/telegram.ts` — copy as-is

### Phase 2: Server orchestration
7. `server/src/lib/tools.ts` — async `buildDeviceTools()` from device registry
8. `server/src/lib/system-prompt.ts` — dynamic device sections from registry
9. `server/src/lib/orchestrator.ts` — use `await buildDeviceTools()`, dynamic `toolToDevice()`, no hardcoded device fallback

### Phase 3: Server routes
10. `server/src/app/api/relay/register/route.ts` — accept masterSecret + metadata, generate per-device token, return it
11. `server/src/app/api/relay/poll/route.ts` — port from prototype, use new auth (token → device identity)
12. `server/src/app/api/relay/respond/route.ts` — port, use new auth
13. `server/src/app/api/devices/route.ts` — GET device list + status
14. `server/src/app/api/telegram/webhook/route.ts` — dynamic help text, dynamic /status
15. `server/src/app/api/telegram/setup/route.ts` — port, master secret auth
16. `server/src/app/api/health/route.ts` — copy as-is
17. `server/src/app/page.tsx` + `layout.tsx` — generic branding from env
18. Verify: `npx tsc --noEmit && npx next build`

### Phase 4: CLI framework
19. Root `package.json` (name: `yuna-bot`, bin: `yuna`), `tsconfig.json`
20. `src/shared/types.ts` — shared types
21. `src/cli/index.ts` + helpers (`config.ts`, `crypto.ts`, `prompts.ts`, `telegram.ts`, `vercel.ts`)
22. `src/cli/init.ts` — wizard
23. `src/cli/add-device.ts`, `status.ts`, `reset.ts`

### Phase 5: Node.js device agent
24. `src/agent/protocol.ts` — wire format types
25. `src/agent/executor.ts` — bash/read_file/write_file with timeout
26. `src/agent/agent.ts` — polling loop with exponential backoff
27. `src/cli/start.ts` — agent launcher with graceful shutdown

### Phase 6: Package + publish
28. `tsup` build config, `bin/yuna.js` shim
29. Test `npx yuna-bot init` end-to-end
30. README.md for yuna.bot
31. `npm publish`

## Verification
1. Server: `cd server && npx tsc --noEmit && npx next build`
2. CLI: `npm run build && node bin/yuna.js --help`
3. E2E: `npx yuna-bot init` → deploys → `yuna add-device` → `yuna start` → send Telegram message → get response
