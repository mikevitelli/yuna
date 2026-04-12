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
├── tsconfig.json             # TypeScript strict mode
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
│   │       └── crypto.ts     # secret generation
│   ├── agent/
│   │   ├── agent.ts          # Node.js polling loop (replaces relay-agent.sh)
│   │   ├── executor.ts       # bash/read_file/write_file execution
│   │   └── protocol.ts       # wire protocol types
│   └── shared/
│       └── types.ts          # DeviceConfig, WireCommand, etc.
└── server/                   # Next.js 15 Vercel app (deployed by user)
    ├── package.json          # @anthropic-ai/sdk, @upstash/redis, next
    ├── tsconfig.json
    ├── next.config.js
    └── src/
        ├── app/
        │   ├── page.tsx
        │   ├── layout.tsx
        │   └── api/
        │       ├── health/route.ts
        │       ├── devices/route.ts
        │       ├── relay/
        │       │   ├── poll/route.ts
        │       │   ├── respond/route.ts
        │       │   └── register/route.ts
        │       └── telegram/
        │           ├── webhook/route.ts
        │           └── setup/route.ts
        └── lib/
            ├── auth.ts
            ├── devices.ts
            ├── orchestrator.ts
            ├── rate-limit.ts
            ├── redis.ts
            ├── system-prompt.ts
            ├── telegram.ts
            └── tools.ts
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
yuna:stream:{name}          → STREAM (command queue, consumer group: "agent")
yuna:conversation:messages  → STRING (shared conversation JSON)
yuna:orchestration:{taskId} → STRING (in-flight task JSON)
```

### Redis Streams protocol
Each device stream (`yuna:stream:{name}`) uses a consumer group named `"agent"` with a single consumer per device.
- **Server → Device**: `XADD yuna:stream:{name} * command <json>` to enqueue a command
- **Device → Server**: `XREADGROUP GROUP agent {deviceName} COUNT 1 BLOCK 30000 STREAMS yuna:stream:{name} >` to poll
- **ACK**: Device calls `XACK yuna:stream:{name} agent {messageId}` after posting result via `/api/relay/respond`
- Consumer group is created at device registration time (`XGROUP CREATE ... $ MKSTREAM`)

### Dynamic tool generation
`buildDeviceTools()` reads device registry, generates:
- `run_on_{deviceName}` tool per device
- `read_file` + `write_file` with dynamic device enum
- `toolToDevice()` mapping derived from device list

### Dynamic system prompt
`buildSystemPrompt()` reads device registry, builds a device section per registered device with its OS, description, capabilities, and online/offline status.

## What's copied from shiny-politoed vs written fresh

### Copied from shiny-politoed (6 files, minor adjustments)
These files contain no hardcoded device logic, but may need import path updates and `sp:` → `yuna:` prefix changes if they reference Redis keys directly.
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

1. Welcome banner
2. "Bot name?" → default "Yuna"
3. "Your name?" → default from `git config user.name`
4. "Telegram bot token?" → validate via getMe API
5. "Telegram user ID?" → for owner lock
6. "Anthropic API key?" → validate format
7. "Redis URL?" → paste Upstash Redis REST URL + token (no auto-create; user brings their own Redis)
8. Generate MASTER_SECRET + TELEGRAM_WEBHOOK_SECRET
9. Deploy to Vercel (or scaffold with `--manual`)
10. Store hashed MASTER_SECRET in Redis
11. Register Telegram webhook
12. Write `~/.config/yuna/config.json` (includes masterSecret for adding devices)
13. "Done! Run `yuna add-device` on each device."

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

## Dependencies

### CLI + agent (root package.json)
- `commander` — subcommands
- `inquirer` — interactive prompts
- `chalk` — colored output
- `ora` — spinners

### Server (server/package.json)
- `next` — Next.js 15
- `@anthropic-ai/sdk` — Claude API
- `@upstash/redis` — Redis REST client
- `react`, `react-dom` — Next.js peer deps

### Build tooling (devDependencies)
- `tsup` — bundle CLI + agent to dist/
- `typescript` — strict mode

## Implementation phases

### Phase 1: Server scaffolding + refactoring
Repo already exists (`mikevitelli/yuna`). Build `devices.ts` first — tools, system-prompt, and auth all depend on it.
1. Scaffold `server/` with `package.json`, `tsconfig.json`, `next.config.js`
2. Create `server/src/lib/devices.ts` — device registry CRUD (all other server modules depend on this)
3. Create `server/src/lib/redis.ts` — Redis client + key helpers with `yuna:` prefix
4. Copy + adjust the 6 portable files from shiny-politoed (update imports, `sp:` → `yuna:` if needed)
5. Rewrite `auth.ts` (per-device token lookup), `tools.ts` (dynamic generation), `system-prompt.ts` (dynamic sections), `orchestrator.ts` (async tools)
6. Add `server/src/app/api/devices/route.ts` + `relay/register/route.ts`
7. Generic landing page + branding (`page.tsx`, `layout.tsx`)
8. Verify: `cd server && npx tsc --noEmit && npx next build`

### Phase 2: CLI framework
9. Root `package.json` (name: `yuna-bot`, bin: `yuna`) + `tsconfig.json`
10. `src/shared/types.ts` — shared types for CLI, agent, and server
11. `src/cli/index.ts` + helpers (`config.ts`, `crypto.ts`, `prompts.ts`)
12. `src/cli/init.ts` — the wizard (no Upstash auto-create; paste URL only)
13. `src/cli/add-device.ts`, `status.ts`, `reset.ts`

### Phase 3: Node.js device agent
14. `src/agent/agent.ts` — polling loop with exponential backoff (1s → 2s → 4s → ... → 30s cap), resets on command received
15. `src/agent/executor.ts` — bash/read_file/write_file execution with timeout + output size limits
16. `src/cli/start.ts` — agent launcher with graceful shutdown (SIGINT/SIGTERM)

### Phase 4: Package + publish
17. `tsup` build config for CLI + agent, `bin/yuna.js` shim
18. Test `npx yuna-bot init` end-to-end
19. README.md for yuna.bot
20. `npm publish`

## Verification
1. Server: `cd server && npx tsc --noEmit && npx next build`
2. CLI: `npm run build && node bin/yuna.js --help`
3. E2E: `npx yuna-bot init` on a fresh machine → deploys, registers webhook, add-device, start, send Telegram message → get response

## Open questions
- **shiny-politoed source access**: The 6 "copied" files and 8 "modified" files need to be pulled from the shiny-politoed repo. Verify each for `sp:` prefix references and import paths before copying.
- **Vercel deploy automation**: `src/cli/helpers/vercel.ts` needs to handle both `vercel` CLI (interactive deploy) and `--manual` mode (output env vars + instructions for manual deploy). Scope TBD.
- **Node.js version**: `>=18` (for native fetch, required by `@upstash/redis`)
