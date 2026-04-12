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
│   │       └── crypto.ts     # secret generation
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

1. Welcome banner
2. "Bot name?" → default "Yuna"
3. "Your name?" → default from `git config user.name`
4. "Telegram bot token?" → validate via getMe API
5. "Telegram user ID?" → for owner lock
6. "Anthropic API key?" → validate format
7. "Redis setup?" → auto-create via Upstash API or paste URL+token
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

## CLI dependencies
- `commander` — subcommands
- `inquirer` — interactive prompts
- `chalk` — colored output
- `ora` — spinners

## Implementation phases

### Phase 1: Create repo + server refactoring
1. `gh repo create mikevitelli/yuna`
2. Copy server/ files, refactor for dynamic devices
3. Create `server/src/lib/devices.ts`
4. Rewrite tools.ts, system-prompt.ts, orchestrator.ts
5. Add `server/src/app/api/devices/route.ts`
6. Generic landing page + branding

### Phase 2: CLI framework
7. Root package.json with commander/inquirer/chalk/ora
8. `src/cli/index.ts` + helpers (config, crypto)
9. `src/cli/init.ts` — the wizard
10. `src/cli/add-device.ts`, `status.ts`, `reset.ts`

### Phase 3: Node.js device agent
11. `src/agent/agent.ts` — polling loop
12. `src/agent/executor.ts` — command execution
13. `src/cli/start.ts` — agent launcher

### Phase 4: Package + publish
14. tsconfig, build script, bin/yuna.js shim
15. Test `npx yuna-bot init` end-to-end
16. README.md for yuna.bot
17. `npm publish`

## Verification
1. `gh repo create mikevitelli/yuna --public`
2. Server: `cd server && npx tsc --noEmit && npx next build`
3. CLI: `npm run build && node bin/yuna.js --help`
4. E2E: `npx yuna-bot init` on a fresh machine → deploys, registers webhook, add-device, start, send Telegram message → get response
