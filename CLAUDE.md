# Yuna — Implementation Guide

## 1. Project Overview

Yuna is a self-hosted, distributable npm CLI (`yuna-bot`) that lets anyone deploy an AI-powered multi-device orchestrator over Telegram. It generalizes the hardcoded 2-device shiny-politoed prototype into a dynamic N-device system where users bring their own API keys, bot character, and devices. The server runs Claude with tool_use on Vercel; devices are stateless command executors that poll for work via Redis Streams.

## 2. Architecture

```
 User (Telegram)
      |
      | webhook POST
      v
 +------------------+       +------------------+
 | Vercel Server    |       | Upstash Redis    |
 | (Next.js 15)     |<----->| (REST API)       |
 |                  |       |                  |
 | /api/telegram/   |       | yuna:stream:{d}  |  <-- per-device command queues
 |   webhook    ----+--+--->| yuna:conversation |  <-- shared chat history
 |                  |  |    | yuna:device:{d}   |  <-- device registry
 | /api/relay/      |  |    | yuna:token:{t}    |  <-- per-device auth tokens
 |   poll     <-----+--+---| yuna:orchestration |  <-- in-flight tasks
 |   respond  ------+--+-->|                  |
 |   register ------+--+-->+------------------+
 |                  |  |
 | orchestrator.ts  |  |    Claude API
 |   calls Claude --+--+--> @anthropic-ai/sdk
 |   dispatches  ---+--+    (tool_use loop)
 +------------------+  |
                       |
      +----------------+----------------+
      |                |                |
 +---------+     +---------+     +---------+
 | Device A |     | Device B |     | Device N |
 | (agent)  |     | (agent)  |     | (agent)  |
 | polls /  |     | polls /  |     | polls /  |
 | relay/   |     | relay/   |     | relay/   |
 | poll     |     | poll     |     | poll     |
 +---------+     +---------+     +---------+
   yuna start      yuna start      yuna start

Flow:
1. User sends Telegram message
2. Webhook hits Vercel -> orchestrator calls Claude API
3. Claude returns tool_use (e.g. run_on_laptop)
4. Orchestrator XADDs command to yuna:stream:laptop
5. Device agent long-polls /api/relay/poll, receives command
6. Device executes bash/read_file/write_file locally
7. Device POSTs result to /api/relay/respond
8. Orchestrator feeds tool_result back to Claude
9. Claude responds -> sent to Telegram
```

## 3. Implementation Status

Everything is stubbed. No source files exist yet under `src/` or `server/src/`.

### Phase 1: Server Foundation
- [ ] `server/package.json` + `server/tsconfig.json` + `server/next.config.ts`
- [ ] `server/src/lib/redis.ts` — Redis client, `yuna:` prefix, stream helpers, conversation, orchestration
- [ ] `server/src/lib/devices.ts` — device registry CRUD (BLOCKER: all other modules depend on this)
- [ ] `server/src/lib/auth.ts` — per-device token validation + master secret
- [ ] `server/src/lib/rate-limit.ts` — sliding window rate limiter
- [ ] `server/src/lib/telegram.ts` — Telegram Bot API helpers

### Phase 2: Server Orchestration
- [ ] `server/src/lib/tools.ts` — dynamic tool generation from device registry
- [ ] `server/src/lib/system-prompt.ts` — dynamic system prompt with device sections
- [ ] `server/src/lib/orchestrator.ts` — Claude API loop, tool dispatch, result handling

### Phase 3: Server Routes
- [ ] `server/src/app/api/relay/register/route.ts` — device registration (setup code + metadata)
- [ ] `server/src/app/api/relay/poll/route.ts` — long-poll for commands
- [ ] `server/src/app/api/relay/respond/route.ts` — device posts command results
- [ ] `server/src/app/api/devices/route.ts` — GET device list + online status
- [ ] `server/src/app/api/telegram/webhook/route.ts` — Telegram message handler
- [ ] `server/src/app/api/telegram/setup/route.ts` — register webhook URL
- [ ] `server/src/app/api/health/route.ts` — Redis ping health check
- [ ] `server/src/app/page.tsx` + `server/src/app/layout.tsx` — landing page

### Phase 4: CLI Framework
- [ ] `src/shared/types.ts` — shared types (DeviceConfig, WireCommand, etc.)
- [ ] `src/cli/index.ts` — commander entry point
- [ ] `src/cli/helpers/config.ts` — `~/.config/yuna/{config,device}.json` read/write
- [ ] `src/cli/helpers/crypto.ts` — secret generation (MASTER_SECRET, webhook secret, setup codes)
- [ ] `src/cli/helpers/prompts.ts` — inquirer wrappers
- [ ] `src/cli/helpers/telegram.ts` — bot token validation + getMe
- [ ] `src/cli/helpers/vercel.ts` — vercel deploy automation
- [ ] `src/cli/helpers/browser.ts` — open URLs cross-platform
- [ ] `src/cli/init.ts` — setup wizard
- [ ] `src/cli/add-device.ts` — register device with setup code
- [ ] `src/cli/create-code.ts` — generate one-time setup code
- [ ] `src/cli/start.ts` — launch device agent
- [ ] `src/cli/status.ts` — server health + device list
- [ ] `src/cli/reset.ts` — clear conversation history
- [ ] `src/cli/revoke-device.ts` — revoke a device token
- [ ] `src/cli/logs.ts` — show audit log

### Phase 5: Device Agent
- [ ] `src/agent/protocol.ts` — wire format types + parsing
- [ ] `src/agent/executor.ts` — bash/read_file/write_file execution with timeout
- [ ] `src/agent/agent.ts` — polling loop with exponential backoff

### Phase 6: Package + Publish
- [ ] Verify: `npm run build` (tsup CLI + Next.js server)
- [ ] Verify: `node bin/yuna.js --help`
- [ ] E2E test: init -> add-device -> start -> Telegram message -> response
- [ ] `npm publish`

## 4. File Implementation Guide

### Phase 1: Server Foundation

#### `server/package.json` + `server/tsconfig.json` + `server/next.config.ts`
- **What:** Next.js 15 app scaffold for Vercel deployment
- **Dependencies:** `next`, `react`, `react-dom`, `@anthropic-ai/sdk`, `@upstash/redis`
- **Dev dependencies:** `typescript`, `@types/node`, `@types/react`
- **tsconfig:** Standard Next.js config with `@/` path alias mapping to `./src/`
- **next.config.ts:** Minimal — `serverExternalPackages: []`, no special config needed
- **Prototype reference:** The prototype's `server/package.json` exists but is not in the source tree — create fresh based on Next.js 15 conventions
- **What's different:** Nothing conceptually — just a clean Next.js scaffold

---

#### `server/src/lib/redis.ts`
- **What:** Upstash Redis client singleton, all stream operations (XADD, XREADGROUP, XACK, XCLAIM, XPENDING), conversation CRUD, orchestration task CRUD, message tracking
- **Depends on:** Nothing (foundational)
- **Key functions:**
  - `redis` — exported Upstash Redis client singleton
  - `streamKey(device)` — returns `yuna:stream:{device}`
  - `ensureConsumerGroup(device)` — XGROUP CREATE with MKSTREAM, caches initialized streams
  - `enqueueMessage(device, msg)` — XADD to device stream, MAXLEN ~1000
  - `readNewMessages(device, count)` — XREADGROUP with consumer group `"agent"`, consumer = device name, ID `">"`
  - `reclaimPendingMessages(device, count)` — XPENDING + XCLAIM for messages idle > 60s
  - `ackMessage(device, streamId)` — XACK
  - `parseXReadResults(results)` — defensive parsing of Upstash REST client response shapes
  - `parseXClaimResults(results)` — same for XCLAIM
  - `parseStreamMessage(msg)` — handles both object `{id, fields}` and array `[id, [k,v,...]]` formats
  - `touchDevice(device)` — SET `yuna:lastseen:{device}` with 86400s TTL
  - `getDeviceStatus(device)` — GET `yuna:lastseen:{device}`
  - `isOnline(device)` — true if lastSeen < 60s ago
  - `trackMessage(msgId, device, prompt)` — SET `yuna:msg:{msgId}` with 86400s TTL
  - `getMessageTarget(msgId)` — GET `yuna:msg:{msgId}`
  - `getConversation()` / `saveConversation(msgs)` / `clearConversation()` — JSON in `yuna:conversation:messages`, 7d TTL, auto-prune at 800KB
  - `createTask(task)` / `getTask(id)` / `saveTask(task)` / `deleteTask(id)` — JSON in `yuna:orchestration:{taskId}`, 5min TTL
  - `appendAuditLog(entry)` — LPUSH + LTRIM 1000 to `yuna:log`
  - `getAuditLog(count)` — LRANGE from `yuna:log`
- **Prototype:** `/home/mikevitelli/claude-relay-repo/server/src/lib/redis.ts`
- **What's different from prototype:**
  - All keys change from `relay:` prefix to `yuna:` prefix (7 locations)
  - Stream consumer group changes from `"relay"` to `"agent"`
  - Remove `DEVICE_LABELS` constant (labels come from device registry now)
  - Remove `registerDevice()` and `getDevices()` (moved to `devices.ts`)
  - Add `appendAuditLog()` and `getAuditLog()` (new feature)
  - All types (`RelayMessage`, `StreamEntry`, `ConversationMessage`, `ToolCall`, `OrchestrationTask`) stay the same structurally

---

#### `server/src/lib/devices.ts`
- **What:** Device registry CRUD — the central module that makes everything dynamic. All other modules read from this to generate tools, system prompts, and route commands.
- **Depends on:** `redis.ts`
- **Key functions:**
  - `registerDevice(name, metadata)` — SADD `yuna:devices` + HSET `yuna:device:{name}` with `{os, description, capabilities, ssh, registeredAt}`
  - `removeDevice(name)` — SREM `yuna:devices` + DEL `yuna:device:{name}` + DEL `yuna:lastseen:{name}` + DEL stream
  - `getDevice(name)` — HGETALL `yuna:device:{name}`
  - `listDevices()` — SMEMBERS `yuna:devices`
  - `listDevicesWithStatus()` — for each device: metadata + online/offline + lastSeen
  - `storeDeviceToken(token, device)` — SET `yuna:token:{token}` with `{device, registeredAt}`
  - `lookupDeviceByToken(token)` — GET `yuna:token:{token}` -> device name
  - `revokeDeviceToken(device)` — scan for token matching device, DEL it
  - `createSetupCode()` — generate `XXXX-XXXX`, SET `yuna:setup-code:{code}` with 600s TTL
  - `validateSetupCode(code)` — GET + DEL (single-use) `yuna:setup-code:{code}`
- **Prototype reference:** No equivalent file — `registerDevice()` and `getDevices()` were 5-line functions in `redis.ts`. This is entirely new.
- **What's different:** Everything is new. The prototype had no device metadata, no tokens, no setup codes, no capabilities.

---

#### `server/src/lib/auth.ts`
- **What:** Request authentication — validates per-device tokens and master secret
- **Depends on:** `devices.ts` (for `lookupDeviceByToken`)
- **Key functions:**
  - `validateDeviceToken(request)` — reads `Authorization: Bearer {token}`, calls `lookupDeviceByToken(token)`, returns `{valid: boolean, device?: string}`
  - `validateMasterSecret(request)` — reads `Authorization: Bearer {secret}`, compares against hashed `MASTER_SECRET` in Redis key `yuna:master`
  - `isOwner(userId)` — checks Telegram user ID against `TELEGRAM_OWNER_ID` env var
- **Prototype:** `/home/mikevitelli/claude-relay-repo/server/src/lib/auth.ts`
- **What's different from prototype:**
  - Prototype: `validateDeviceSecret()` compared Bearer token against a single `DEVICE_SECRET` env var (shared secret)
  - Yuna: `validateDeviceToken()` looks up `yuna:token:{token}` in Redis to get device identity — each device has its own token
  - Prototype: 7 lines total. Yuna: ~40 lines.
  - `isOwner()` stays identical

---

#### `server/src/lib/rate-limit.ts`
- **What:** Sliding window rate limiter using Redis INCR + EXPIRE
- **Depends on:** `redis.ts` (imports `redis` client)
- **Key functions:**
  - `isRateLimited(key, maxRequests, windowSeconds)` — returns boolean
- **Prototype:** `/home/mikevitelli/claude-relay-repo/server/src/lib/rate-limit.ts`
- **What's different:** Copy as-is. The rate limit key prefix is `ratelimit:` (not `relay:`), so no rename needed.

---

#### `server/src/lib/telegram.ts`
- **What:** Telegram Bot API helpers — send messages, set webhook, verify webhook secret, markdown-to-HTML conversion
- **Depends on:** Nothing (uses `TELEGRAM_BOT_TOKEN` env var directly)
- **Key functions:**
  - `sendMessage(chatId, text, replyToMessageId?)` — POST sendMessage, auto-splits at 4000 chars, retries without HTML on parse failure
  - `sendTyping(chatId)` — POST sendChatAction typing
  - `setWebhook(url)` — POST setWebhook with secret_token
  - `splitMessage(text, maxLen)` — splits on newlines preferentially
  - `verifyWebhook(request)` — checks `x-telegram-bot-api-secret-token` header
  - `escapeHtml(text)` — escapes `&`, `<`, `>`
  - `mdToTgHtml(text)` — converts markdown to Telegram HTML (code blocks, bold, italic, strikethrough, headers, bullets)
- **Prototype:** `/home/mikevitelli/claude-relay-repo/server/src/lib/telegram.ts`
- **What's different:** Copy as-is. Fully generic — no device-specific logic.

---

### Phase 2: Server Orchestration

#### `server/src/lib/tools.ts`
- **What:** Dynamically generates Claude tool definitions from the device registry. No hardcoded device names.
- **Depends on:** `devices.ts` (for `listDevices`, `getDevice`)
- **Key functions:**
  - `buildDeviceTools()` — async function that reads all registered devices and generates:
    - One `run_on_{deviceName}` tool per device (same schema as prototype's `run_on_uconsole`)
    - `read_file` tool with dynamic `device` enum populated from device list
    - `write_file` tool with dynamic `device` enum populated from device list
    - Returns `Anthropic.Tool[]`
  - `buildToolToDeviceMap()` — async function that returns `Record<string, string>` mapping tool names to device names (e.g. `{"run_on_laptop": "laptop", "run_on_pi": "pi"}`)
- **Prototype:** `/home/mikevitelli/claude-relay-repo/server/src/lib/tools.ts`
- **What's different from prototype:**
  - Prototype: `DEVICE_TOOLS` is a static `const` array with hardcoded `run_on_uconsole` and `run_on_mac` tools, hardcoded `enum: ["uconsole", "mac"]` in read_file/write_file
  - Prototype: `toolToDevice()` is a static function with `if` statements for each device
  - Yuna: Both are async functions that query Redis. Must be called with `await` everywhere.
  - Prototype was 107 lines. Yuna will be ~80 lines (shorter due to loop generation).

---

#### `server/src/lib/system-prompt.ts`
- **What:** Builds the Claude system prompt dynamically from device registry, including per-device OS, description, capabilities, and online/offline status
- **Depends on:** `devices.ts` (for `listDevicesWithStatus`), `redis.ts` (for `isOnline`)
- **Key functions:**
  - `buildSystemPrompt()` — async, returns `Anthropic.TextBlockParam[]` (single text block with `cache_control: {type: "ephemeral"}`)
  - Reads `BOT_NAME`, `OWNER_NAME`, `REPO_URL`, `SYSTEM_PROMPT_EXTRA` from env vars
  - Iterates all registered devices, builds a `### {DeviceName} [ONLINE/OFFLINE]` section for each with metadata from the registry
- **Prototype:** `/home/mikevitelli/claude-relay-repo/server/src/lib/system-prompt.ts`
- **What's different from prototype:**
  - Prototype: hardcoded 2 device sections (`uConsole` and `Mac`) with hardcoded descriptions (or env var overrides)
  - Prototype: `Promise.all([isOnline("uconsole"), isOnline("mac")])` — checks exactly 2 devices
  - Yuna: loops over `listDevicesWithStatus()`, builds device sections dynamically from registry metadata
  - The identity/architecture/guidelines sections of the prompt stay the same structurally

---

#### `server/src/lib/orchestrator.ts`
- **What:** The brain. Handles user messages from Telegram, calls Claude API with tool_use, dispatches tool calls to device streams, handles device results, loops until Claude gives a text response or hits max steps.
- **Depends on:** `redis.ts`, `tools.ts`, `system-prompt.ts`, `telegram.ts`, `devices.ts`
- **Key functions:**
  - `handleUserMessage(chatId, messageId, text)` — entry point from webhook. Loads conversation, appends user message, calls Claude, dispatches tools or returns text.
  - `handleToolResult(taskId, output, exitCode)` — continuation from device response. Updates task, dispatches next tool call or feeds all results back to Claude.
  - `callClaude(model, history)` — calls `client.messages.create()` with `await buildDeviceTools()` and `await buildSystemPrompt()`
  - `dispatchToolCalls(response, chatId, messageId, model, depth)` — extracts all `tool_use` blocks, checks device online status, creates `OrchestrationTask`, dispatches first pending command
  - `dispatchSingleCommand(taskId, toolCall, chatId, messageId)` — builds `RelayMessage`, calls `enqueueMessage(device, msg)`
  - `parseModelOverride(text)` — extracts `@opus`/`@sonnet`/`@haiku` prefix from user message
- **Prototype:** `/home/mikevitelli/claude-relay-repo/server/src/lib/orchestrator.ts`
- **What's different from prototype:**
  - `callClaude()`: prototype uses static `DEVICE_TOOLS` constant; Yuna uses `await buildDeviceTools()` (async)
  - `dispatchToolCalls()`: prototype falls back to `"uconsole"` when device can't be determined; Yuna should return an error tool_result if device is unknown
  - `dispatchToolCalls()`: prototype uses static `DEVICE_LABELS[device]`; Yuna gets label from device registry
  - `dispatchToolCalls()`: prototype uses sync `toolToDevice()`; Yuna uses async `buildToolToDeviceMap()` (call once at dispatch start, not per-tool)
  - Add audit logging: after each command execution, call `appendAuditLog()` with command details
  - Model map: keep the same `opus/sonnet/haiku` override parsing
  - Constants: `MAX_STEPS = 10`, `MAX_OFFLINE_RETRIES = 3`, `DEFAULT_MODEL = "claude-haiku-4-5-20251001"` — keep same

---

### Phase 3: Server Routes

#### `server/src/app/api/relay/register/route.ts`
- **What:** Device registration endpoint. Validates setup code, stores device metadata, issues per-device token.
- **Depends on:** `devices.ts`, `redis.ts`
- **Key functions:**
  - `POST` handler: accepts `{code, name, os, description, capabilities, ssh}`, validates setup code, generates UUID token, stores device + token, returns `{ok, token, device}`
- **Prototype:** `/home/mikevitelli/claude-relay-repo/server/src/app/api/relay/register/route.ts`
- **What's different from prototype:**
  - Prototype: validates shared `DEVICE_SECRET`, accepts just `{device}`, calls `registerDevice(device)` + `ensureConsumerGroup(device)` + `touchDevice(device)`
  - Yuna: validates one-time setup code instead of shared secret, accepts full device metadata, generates per-device token, stores in registry
  - Prototype was 35 lines. Yuna will be ~60 lines.

---

#### `server/src/app/api/relay/poll/route.ts`
- **What:** Long-poll endpoint for device agents. Returns pending commands from device's Redis Stream.
- **Depends on:** `redis.ts`, `auth.ts`
- **Key functions:**
  - `GET` handler: validates device token (gets device identity from token), touches heartbeat, reclaims pending messages, then long-polls (2s intervals, 25s timeout)
  - `maxDuration = 30` (Vercel serverless timeout)
- **Prototype:** `/home/mikevitelli/claude-relay-repo/server/src/app/api/relay/poll/route.ts`
- **What's different from prototype:**
  - Auth: prototype calls `validateDeviceSecret(request)` (shared secret) and reads `device` from query param
  - Yuna: calls `validateDeviceToken(request)` which returns `{valid, device}` — the device identity comes from the token, not a query param
  - Everything else (long-poll logic, reclaim, sleep loop) stays identical

---

#### `server/src/app/api/relay/respond/route.ts`
- **What:** Device posts command results here. Feeds output back into orchestrator.
- **Depends on:** `redis.ts`, `auth.ts`, `orchestrator.ts`, `telegram.ts`
- **Key functions:**
  - `POST` handler: validates device token, ACKs stream message, calls `handleToolResult(taskId, output, exitCode)`
  - `maxDuration = 60` (Claude API call happens inside handleToolResult)
- **Prototype:** `/home/mikevitelli/claude-relay-repo/server/src/app/api/relay/respond/route.ts`
- **What's different from prototype:**
  - Auth: same change as poll (per-device token instead of shared secret)
  - Device identity from token instead of request body
  - Remove legacy fields (`chatId`, `text`, `sessionId`, `replyToMessageId`) — clean interface only
  - Everything else stays identical

---

#### `server/src/app/api/devices/route.ts`
- **What:** GET endpoint returning all registered devices with online/offline status. Used by CLI `yuna status`.
- **Depends on:** `devices.ts`, `auth.ts`
- **Key functions:**
  - `GET` handler: validates master secret, calls `listDevicesWithStatus()`, returns JSON array
- **Prototype:** No equivalent — entirely new.

---

#### `server/src/app/api/telegram/webhook/route.ts`
- **What:** Telegram sends all bot messages here. Handles text messages, commands (/start, /status, /reset), and reactions.
- **Depends on:** `redis.ts`, `telegram.ts`, `orchestrator.ts`, `auth.ts`, `rate-limit.ts`, `devices.ts`
- **Key functions:**
  - `POST` handler: verifies webhook secret, rate-limits, routes to message/command/reaction handlers
  - `handleStatus(chatId)` — dynamically lists all devices with online/offline status (no hardcoded device names)
  - `handleReaction(reaction)` — emoji-to-action mapping, feeds through orchestrator
  - `timeSince(date)` — human-readable time ago
- **Prototype:** `/home/mikevitelli/claude-relay-repo/server/src/app/api/telegram/webhook/route.ts`
- **What's different from prototype:**
  - `/start` help text: prototype hardcodes `@mac` and `@uconsole`; Yuna lists registered devices dynamically
  - `handleStatus()`: prototype uses `DEVICE_LABELS` constant; Yuna uses `listDevicesWithStatus()` from device registry
  - Reaction handling: stays identical
  - Rate limiting: stays identical (30/min)

---

#### `server/src/app/api/telegram/setup/route.ts`
- **What:** One-time call to register the Telegram webhook URL with Telegram's API.
- **Depends on:** `telegram.ts`, `auth.ts`
- **Key functions:**
  - `POST` handler: validates master secret (not device token), calls `setWebhook(url)`
- **Prototype:** `/home/mikevitelli/claude-relay-repo/server/src/app/api/telegram/setup/route.ts`
- **What's different from prototype:**
  - Auth: prototype uses `validateDeviceSecret()`; Yuna uses `validateMasterSecret()` (only admin should set webhooks)
  - Everything else identical

---

#### `server/src/app/api/health/route.ts`
- **What:** Health check — pings Redis.
- **Depends on:** `redis.ts`
- **Key functions:**
  - `GET` handler: calls `redis.ping()`, returns `{status: "ok"}` or `{status: "redis_error"}`
- **Prototype:** `/home/mikevitelli/claude-relay-repo/server/src/app/api/health/route.ts`
- **What's different:** Copy as-is. No auth needed.

---

#### `server/src/app/page.tsx` + `server/src/app/layout.tsx`
- **What:** Landing page for the Vercel deployment. Shows bot name, architecture diagram, status badges.
- **Depends on:** Nothing
- **Prototype:** `/home/mikevitelli/claude-relay-repo/server/src/app/page.tsx` and `layout.tsx`
- **What's different from prototype:**
  - Replace all "Shiny Politoed" branding with env vars: `NEXT_PUBLIC_BOT_NAME`, `NEXT_PUBLIC_REPO_URL`
  - Remove the politoed.png image reference
  - Keep the same visual structure (gradient background, status badges, architecture flow)
  - `layout.tsx`: change title to use `NEXT_PUBLIC_BOT_NAME` or default "Yuna"

---

### Phase 4: CLI Framework

#### `src/shared/types.ts`
- **What:** TypeScript types shared between CLI, agent, and server
- **Depends on:** Nothing
- **Key types:**
  - `YunaConfig` — `{serverUrl, masterSecret, botName, ownerName, telegramBotToken, telegramOwnerId}` (stored in `~/.config/yuna/config.json`)
  - `DeviceConfig` — `{serverUrl, deviceToken, deviceName}` (stored in `~/.config/yuna/device.json`)
  - `WireCommand` — `{type: "command", taskId: string, tool: string, input: Record<string, unknown>}`
  - `WireResponse` — `{device: string, taskId: string, output: string, exitCode: number, streamId: string}`
  - `DeviceMetadata` — `{os: string, description: string, capabilities: string[], ssh?: Record<string, string>, registeredAt: string}`
- **Prototype reference:** Types were inline in `redis.ts`. Extract and formalize here.

---

#### `src/cli/index.ts`
- **What:** Commander entry point. Registers all subcommands.
- **Depends on:** All `src/cli/*.ts` command files
- **Key implementation:**
  - `program.name("yuna").version(pkg.version)`
  - Register: `init`, `create-code`, `add-device`, `start`, `status`, `reset`, `revoke-device`, `logs`
  - `program.parse()`
- **Prototype reference:** No equivalent — entirely new.

---

#### `src/cli/helpers/config.ts`
- **What:** Read/write `~/.config/yuna/config.json` (admin config) and `~/.config/yuna/device.json` (device config)
- **Depends on:** `shared/types.ts`
- **Key functions:**
  - `getConfigDir()` — `$XDG_CONFIG_HOME/yuna` or `~/.config/yuna`
  - `readConfig()` / `writeConfig(config)` — admin config JSON
  - `readDeviceConfig()` / `writeDeviceConfig(config)` — device config JSON
  - `hasConfig()` / `hasDeviceConfig()` — existence checks
- **Prototype reference:** The bash relay-agent used `~/.config/claude-relay/relay.env`. Yuna uses JSON.

---

#### `src/cli/helpers/crypto.ts`
- **What:** Secret generation utilities
- **Key functions:**
  - `generateMasterSecret()` — `crypto.randomBytes(32).toString("hex")`
  - `generateWebhookSecret()` — `crypto.randomBytes(16).toString("hex")`
  - `generateSetupCode()` — `XXXX-XXXX` format (alphanumeric, uppercase)
  - `generateDeviceToken()` — `crypto.randomUUID()`

---

#### `src/cli/helpers/prompts.ts`
- **What:** Inquirer wrapper functions for the init wizard
- **Key functions:**
  - `askBotName()`, `askOwnerName()`, `askTelegramToken()`, `askTelegramOwnerId()`, `askAnthropicKey()`, `askRedisUrl()`, `askRedisToken()`
  - Each validates input format before accepting

---

#### `src/cli/helpers/telegram.ts`
- **What:** Validates Telegram bot token by calling `getMe` API
- **Key functions:**
  - `validateBotToken(token)` — calls `https://api.telegram.org/bot{token}/getMe`, returns `{valid, username, firstName}` or `{valid: false, error}`
  - `setupWebhook(serverUrl, botToken, webhookSecret)` — calls `setWebhook` API

---

#### `src/cli/helpers/vercel.ts`
- **What:** Automates Vercel deployment
- **Key functions:**
  - `isVercelInstalled()` — checks `vercel --version`
  - `isVercelLoggedIn()` — checks `vercel whoami`
  - `deployServer(serverDir, envVars)` — runs `vercel deploy --prod`, sets env vars
  - `getDeploymentUrl()` — parses vercel output for URL

---

#### `src/cli/helpers/browser.ts`
- **What:** Opens URLs in the default browser cross-platform
- **Key functions:**
  - `openBrowser(url)` — uses the `open` npm package

---

#### `src/cli/init.ts`
- **What:** The setup wizard. Guides user through all configuration, deploys server, registers webhook.
- **Depends on:** All helpers, `shared/types.ts`
- **Key flow:**
  1. Ask bot name + owner name
  2. Guide through Telegram bot token (open BotFather if needed) + validate
  3. Guide through Anthropic API key
  4. Guide through Upstash Redis URL + token (test connection)
  5. Generate MASTER_SECRET + TELEGRAM_WEBHOOK_SECRET
  6. Deploy to Vercel (or scaffold for manual deploy)
  7. Store hashed MASTER_SECRET in Redis
  8. Register Telegram webhook
  9. Write `~/.config/yuna/config.json`
  10. Print success + next steps
- **Prototype reference:** No equivalent — relay-agent.sh used a static `.env` file.

---

#### `src/cli/add-device.ts`
- **What:** Register this machine as a device using a one-time setup code.
- **Depends on:** `helpers/config.ts`, `helpers/prompts.ts`, `shared/types.ts`
- **Key flow:**
  1. Accept `--code XXXX-XXXX` flag
  2. Ask device name, auto-detect OS, ask description + capabilities
  3. POST to `{serverUrl}/api/relay/register` with code + metadata
  4. Server validates code, returns device token
  5. Write `~/.config/yuna/device.json`
- **Prototype reference:** relay-agent.sh's register curl call, but with setup codes instead of shared secret.

---

#### `src/cli/create-code.ts`
- **What:** Admin command to generate a one-time setup code for a new device.
- **Depends on:** `helpers/config.ts`
- **Key flow:**
  1. Read admin config for serverUrl + masterSecret
  2. POST to server endpoint that creates a setup code
  3. Print code + "expires in 10 minutes"

---

#### `src/cli/start.ts`
- **What:** Launches the device agent with graceful shutdown handling.
- **Depends on:** `helpers/config.ts`, `agent/agent.ts`
- **Key flow:**
  1. Read device config
  2. Create agent instance with serverUrl + deviceToken + deviceName
  3. Register SIGINT/SIGTERM handlers for graceful shutdown
  4. Start polling loop
  5. `--daemon` flag: fork to background (optional, Phase 6)

---

#### `src/cli/status.ts`
- **What:** Show server health and device list with online/offline status.
- **Depends on:** `helpers/config.ts`
- **Key flow:**
  1. Read admin config
  2. GET `{serverUrl}/api/health` — show server status
  3. GET `{serverUrl}/api/devices` — list all devices with status

---

#### `src/cli/reset.ts`
- **What:** Clear conversation history.
- **Depends on:** `helpers/config.ts`
- **Key flow:**
  1. Read admin config
  2. POST or DELETE to server endpoint that clears conversation
  3. Print confirmation

---

### Phase 5: Device Agent

#### `src/agent/protocol.ts`
- **What:** Wire protocol type definitions and parsing/serialization helpers
- **Depends on:** `shared/types.ts`
- **Key types/functions:**
  - `PollResponse` — `{messages: Array<{streamId: string, message: {text: string, target: string, ...}}>}`
  - `parseCommand(text: string)` — parses JSON command from stream message text, returns `WireCommand`
  - `buildResponse(device, taskId, output, exitCode, streamId)` — builds `WireResponse` JSON

---

#### `src/agent/executor.ts`
- **What:** Executes bash commands, reads files, writes files — the device-side command handler.
- **Depends on:** `protocol.ts`
- **Key functions:**
  - `executeCommand(command: WireCommand)` — dispatcher that routes to the right handler based on `tool` field
  - `executeBash(command, workingDir, timeoutSeconds)` — spawns `bash -c` with timeout, captures stdout+stderr, truncates output at 8000 chars (keep first 4000 + last 4000)
  - `executeReadFile(path, maxLines)` — reads file with line limit
  - `executeWriteFile(path, content)` — creates parent dirs, writes file
  - Returns `{output: string, exitCode: number}`
- **Prototype:** `/home/mikevitelli/claude-relay-repo/relay-agent.sh` (bash version)
- **What's different from prototype:**
  - Prototype is bash (170 lines): uses `jq` for JSON parsing, `curl` for HTTP, `timeout`/`perl` for process timeout
  - Yuna is Node.js: uses `child_process.spawn()` for bash execution, native `fs` for file ops, `AbortController` for timeouts
  - Same truncation logic (8000 chars, keep first+last 4000)
  - Same tool routing: `run_on_{device}` -> bash, `read_file` -> head, `write_file` -> write
  - Node.js version is more robust: proper signal handling, no jq dependency, structured error types

---

#### `src/agent/agent.ts`
- **What:** The main polling loop. Continuously long-polls the server for commands, executes them, posts results back.
- **Depends on:** `executor.ts`, `protocol.ts`, `shared/types.ts`
- **Key functions:**
  - `class DeviceAgent` with:
    - `constructor(serverUrl, deviceToken, deviceName)`
    - `start()` — begins polling loop
    - `stop()` — graceful shutdown (finish current command, stop polling)
    - `poll()` — GET `{serverUrl}/api/relay/poll` with Bearer token, parse response
    - `processMessages(messages)` — for each message: parse command, execute, post result
    - `postResult(response)` — POST to `{serverUrl}/api/relay/respond`
  - Exponential backoff on poll failures: 5s, 10s, 20s, 40s, max 60s. Reset on success.
  - Heartbeat: each poll touches lastSeen on the server (server does this on poll request)
- **Prototype:** `/home/mikevitelli/claude-relay-repo/relay-agent.sh` (the `while true` loop)
- **What's different from prototype:**
  - Prototype: bash `while true` with `curl --max-time 35` for long-polling, fixed 5s retry on failure
  - Yuna: Node.js with `fetch()`, exponential backoff, graceful shutdown via SIGINT/SIGTERM
  - Prototype: registers on startup with curl; Yuna: registration is separate (`yuna add-device`), agent just polls
  - Prototype: reads config from `.env` file; Yuna: reads from `~/.config/yuna/device.json`

---

## 5. Redis Key Reference

| Key | Type | TTL | Description |
|-----|------|-----|-------------|
| `yuna:devices` | SET | none | Set of all registered device names |
| `yuna:device:{name}` | HASH | none | Device metadata: `os`, `description`, `capabilities` (JSON array), `ssh` (JSON object), `registeredAt` |
| `yuna:token:{token}` | STRING | none | Maps device token (UUID) to `{device, registeredAt}` JSON |
| `yuna:setup-code:{code}` | STRING | 600s (10min) | One-time device registration code. Value: `{createdAt}` JSON. Deleted after use. |
| `yuna:master` | STRING | none | Hashed MASTER_SECRET for admin auth validation |
| `yuna:stream:{name}` | STREAM | none | Per-device command queue. Consumer group: `"agent"`. MAXLEN ~1000. |
| `yuna:lastseen:{name}` | STRING | 86400s (24h) | ISO timestamp of last poll from device. Online if < 60s ago. |
| `yuna:conversation:messages` | STRING | 604800s (7d) | Shared conversation history as JSON array of `{role, content}`. Auto-pruned at 800KB. |
| `yuna:orchestration:{taskId}` | STRING | 300s (5min) | In-flight orchestration task JSON. Contains all tool calls, current index, step count. |
| `yuna:msg:{msgId}` | STRING | 86400s (24h) | Telegram message tracking: maps outgoing msg ID to `{device, prompt}` for reaction routing. |
| `yuna:log` | LIST | none | Audit log. LPUSH + LTRIM 1000. Each entry is a JSON object (see below). |
| `ratelimit:{key}` | STRING | varies | Rate limiter counters. Key is e.g. `ratelimit:telegram-webhook`. |

### Audit Log Entry Shape
```json
{
  "ts": "2026-04-12T10:30:00.000Z",
  "type": "command|response|error",
  "device": "laptop",
  "tool": "run_on_laptop",
  "command": "ls -la",
  "exitCode": 0,
  "outputLength": 1234,
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "durationMs": 500
}
```

## 6. Wire Protocol

### Server -> Device (Redis Stream `yuna:stream:{name}`)

The stream entry has a single `data` field containing a JSON-serialized `RelayMessage`:

```json
{
  "id": "task-uuid",
  "from": "orchestrator",
  "chatId": 123456789,
  "messageId": 42,
  "text": "{\"type\":\"command\",\"taskId\":\"task-uuid\",\"tool\":\"run_on_laptop\",\"input\":{\"command\":\"ls -la\",\"working_directory\":\"/home/user\",\"timeout_seconds\":30}}",
  "target": "laptop",
  "timestamp": "2026-04-12T10:30:00.000Z"
}
```

The `text` field is a JSON string containing the actual command:

```json
{
  "type": "command",
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "tool": "run_on_laptop",
  "input": {
    "command": "ls -la",
    "working_directory": "/home/user",
    "timeout_seconds": 30
  }
}
```

Tool input shapes by tool type:

**`run_on_{device}`:**
```json
{
  "command": "ls -la /etc",
  "working_directory": "/home/user",
  "timeout_seconds": 30
}
```

**`read_file`:**
```json
{
  "device": "laptop",
  "path": "/etc/hostname",
  "max_lines": 200
}
```

**`write_file`:**
```json
{
  "device": "laptop",
  "path": "/tmp/test.txt",
  "content": "hello world"
}
```

### Device -> Server (POST `/api/relay/respond`)

```json
{
  "device": "laptop",
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "output": "total 64\ndrwxr-xr-x 2 user user 4096 Apr 12 10:30 .",
  "exitCode": 0,
  "streamId": "1712918400000-0"
}
```

### Poll Response (GET `/api/relay/poll`)

```json
{
  "messages": [
    {
      "streamId": "1712918400000-0",
      "message": {
        "id": "task-uuid",
        "from": "orchestrator",
        "chatId": 123456789,
        "messageId": 42,
        "text": "{...command JSON...}",
        "target": "laptop",
        "timestamp": "2026-04-12T10:30:00.000Z"
      }
    }
  ]
}
```

## 7. Auth Model

### Actors and Secrets

| Actor | Secret | Storage | Purpose |
|-------|--------|---------|---------|
| Admin (init machine) | `MASTER_SECRET` | Vercel env var + hashed in Redis `yuna:master` | Admin operations: create setup codes, list devices, set webhook |
| Device agent | Device token (UUID) | Redis `yuna:token:{token}`, device's `~/.config/yuna/device.json` | Poll for commands, post results |
| Telegram | `TELEGRAM_WEBHOOK_SECRET` | Vercel env var, sent via `setWebhook` API | Verify incoming webhooks are from Telegram |
| Telegram user | `TELEGRAM_OWNER_ID` | Vercel env var | Lock bot to one Telegram user |

### Full Auth Flow

**1. Init (one-time setup):**
```
yuna init
  -> generates MASTER_SECRET (64-char hex)
  -> generates TELEGRAM_WEBHOOK_SECRET (32-char hex)
  -> deploys server to Vercel with env vars:
     MASTER_SECRET, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_BOT_TOKEN,
     TELEGRAM_OWNER_ID, ANTHROPIC_API_KEY, UPSTASH_REDIS_REST_URL,
     UPSTASH_REDIS_REST_TOKEN, BOT_NAME, OWNER_NAME
  -> hashes MASTER_SECRET, stores in Redis as yuna:master
  -> calls /api/telegram/setup to register webhook
  -> writes ~/.config/yuna/config.json with serverUrl + masterSecret
```

**2. Create Setup Code (admin machine):**
```
yuna create-code
  -> POST /api/devices/create-code (Authorization: Bearer {masterSecret})
  -> server generates "ABCD-1234", stores in yuna:setup-code:ABCD-1234 (10min TTL)
  -> prints code to terminal
```

**3. Register Device (new device):**
```
yuna add-device --code ABCD-1234
  -> POST /api/relay/register with {code: "ABCD-1234", name, os, description, capabilities}
  -> server validates code: GET yuna:setup-code:ABCD-1234
     -> if missing/expired: 401
     -> if valid: DEL the code (single-use)
  -> server generates device token (UUID)
  -> server stores:
     - SADD yuna:devices {name}
     - HSET yuna:device:{name} {metadata}
     - SET yuna:token:{token} {device: name, registeredAt}
     - ensureConsumerGroup for yuna:stream:{name}
  -> returns {ok: true, token: "uuid"}
  -> device writes ~/.config/yuna/device.json with {serverUrl, deviceToken, deviceName}
```

**4. Device Polling (ongoing):**
```
yuna start
  -> GET /api/relay/poll (Authorization: Bearer {deviceToken})
  -> server: lookupDeviceByToken(token) -> {device: "laptop"}
  -> server: touchDevice("laptop"), readNewMessages("laptop")
  -> device: execute command, POST /api/relay/respond (Authorization: Bearer {deviceToken})
```

**5. Revoke Device:**
```
yuna revoke-device laptop
  -> server: delete yuna:token:{token}, remove from yuna:devices, delete yuna:device:laptop
  -> device's token becomes invalid, poll returns 401
```

### Server Route Auth Matrix

| Route | Auth Method | Who Can Call |
|-------|-------------|-------------|
| `GET /api/health` | None | Anyone |
| `POST /api/telegram/webhook` | Webhook secret header | Telegram |
| `POST /api/telegram/setup` | Master secret | Admin CLI |
| `POST /api/relay/register` | Setup code in body | New device (one-time) |
| `GET /api/relay/poll` | Device token | Registered device |
| `POST /api/relay/respond` | Device token | Registered device |
| `GET /api/devices` | Master secret | Admin CLI |
| `POST /api/devices/create-code` | Master secret | Admin CLI |

## 8. Testing

### Phase 1 Verification: Server Foundation
```bash
cd server && npx tsc --noEmit
```
- All lib files should compile without errors
- No runtime test needed yet — these are pure modules

### Phase 2 Verification: Orchestration
```bash
cd server && npx tsc --noEmit
```
- `tools.ts` generates correct tool schemas (inspect output shape)
- `system-prompt.ts` builds valid prompt with no devices registered

### Phase 3 Verification: Full Server
```bash
cd server && npx tsc --noEmit && npx next build
```
- All routes compile and build
- Deploy to Vercel (or run `npm run dev` locally with `.env.local`)
- Test endpoints:
  - `curl https://your-app.vercel.app/api/health` -> `{"status":"ok"}`
  - Register webhook via setup endpoint
  - Send a Telegram message -> should get "No devices registered" or similar

### Phase 4 Verification: CLI
```bash
npm run build:cli && node bin/yuna.js --help
```
- All commands listed
- `yuna init` runs wizard (can Ctrl+C to abort)
- Config files created in `~/.config/yuna/`

### Phase 5 Verification: Device Agent
```bash
npm run build:cli && node bin/yuna.js start
```
- Agent connects and polls (should see "Ready. Listening as {device}...")
- Send a Telegram message that triggers a device tool
- Device executes command, posts result, Claude responds in Telegram

### E2E Smoke Test
1. `npx yuna-bot init` -> complete wizard -> server deployed
2. `yuna create-code` -> get setup code
3. On same or different machine: `yuna add-device --code XXXX-XXXX`
4. `yuna start` -> agent running
5. Send Telegram message: "what's the hostname of my device?"
6. Bot responds with hostname
7. `yuna status` -> shows device online
8. `yuna reset` -> conversation cleared
9. `yuna logs` -> shows command execution log

## 9. Development Workflow

### Local Server Development
```bash
# Start Next.js dev server (hot reload)
cd /home/mikevitelli/yuna/server
cp .env.example .env.local  # fill in real keys
npm run dev
# Server runs at http://localhost:3000

# For Telegram testing, expose via ngrok:
ngrok http 3000
# Then set webhook to ngrok URL
```

### CLI Development
```bash
# Build CLI only (fast — uses tsup)
npm run build:cli

# Test CLI commands
node bin/yuna.js --help
node bin/yuna.js status
node bin/yuna.js start

# Or link globally for development
npm link
yuna --help
```

### Full Build
```bash
# Build everything (CLI + server)
npm run build

# Type-check everything
npm run typecheck
```

### Testing the Agent Locally
```bash
# After init + add-device:
node bin/yuna.js start
# Agent polls your deployed (or local) server
# Send Telegram messages to test

# For debugging, the agent logs to stdout:
# [10:30:00] Ready. Listening as laptop...
# [10:30:05] <- [run_on_laptop] ls -la
# [10:30:05] -> 1234 chars (exit 0)
```

### Deploy Server to Vercel
```bash
# Via CLI wizard (recommended):
yuna init
# Handles everything: deploy, env vars, webhook

# Manual deploy:
cd server
vercel deploy --prod
vercel env add MASTER_SECRET
vercel env add TELEGRAM_BOT_TOKEN
# ... etc for all env vars
```

### Vercel Environment Variables (complete list)
```
MASTER_SECRET              # 64-char hex, generated by init
TELEGRAM_BOT_TOKEN         # from BotFather
TELEGRAM_OWNER_ID          # numeric Telegram user ID
TELEGRAM_WEBHOOK_SECRET    # 32-char hex, generated by init
ANTHROPIC_API_KEY          # sk-ant-...
UPSTASH_REDIS_REST_URL     # https://...upstash.io
UPSTASH_REDIS_REST_TOKEN   # AX...
BOT_NAME                   # display name (default: "Yuna")
OWNER_NAME                 # user's name
REPO_URL                   # optional: GitHub repo URL
SYSTEM_PROMPT_EXTRA        # optional: appended to system prompt
```

## 10. Reference: Shiny Politoed Prototype

Prototype location: `/home/mikevitelli/claude-relay-repo/server/src/`
Bash agent: `/home/mikevitelli/claude-relay-repo/relay-agent.sh`

### File Mapping

| Prototype File | Yuna File | Status | Notes |
|---|---|---|---|
| `lib/redis.ts` | `server/src/lib/redis.ts` | **Port + modify** | Rename all `relay:` -> `yuna:`, consumer group `"relay"` -> `"agent"`, remove `DEVICE_LABELS`, remove `registerDevice()`/`getDevices()` (moved to devices.ts), add audit log functions |
| `lib/auth.ts` | `server/src/lib/auth.ts` | **Rewrite** | 7 lines -> ~40 lines. Shared `DEVICE_SECRET` env var -> per-device token lookup in Redis via `yuna:token:{token}`. Add `validateMasterSecret()`. Keep `isOwner()` unchanged. |
| `lib/tools.ts` | `server/src/lib/tools.ts` | **Rewrite** | Static const array with 2 hardcoded devices -> async `buildDeviceTools()` that reads device registry. Static `toolToDevice()` if-chain -> async `buildToolToDeviceMap()` from registry. |
| `lib/system-prompt.ts` | `server/src/lib/system-prompt.ts` | **Rewrite** | Hardcoded 2 device sections with `isOnline("uconsole")`/`isOnline("mac")` -> dynamic loop over `listDevicesWithStatus()`. Same prompt structure/personality, just dynamic device list. |
| `lib/orchestrator.ts` | `server/src/lib/orchestrator.ts` | **Port + modify** | Change `DEVICE_TOOLS` const -> `await buildDeviceTools()`. Change `toolToDevice()` sync -> `await buildToolToDeviceMap()`. Remove `DEVICE_LABELS` usage. Remove hardcoded `"uconsole"` fallback. Add audit logging. All orchestration logic (step counting, tool dispatch, result handling) stays the same. |
| `lib/rate-limit.ts` | `server/src/lib/rate-limit.ts` | **Copy as-is** | Generic rate limiter. Uses `ratelimit:` prefix (not `relay:`), no changes needed. |
| `lib/telegram.ts` | `server/src/lib/telegram.ts` | **Copy as-is** | Generic Telegram helpers. No device-specific logic. |
| `app/api/health/route.ts` | `server/src/app/api/health/route.ts` | **Copy as-is** | Pings Redis, no auth. |
| `app/api/relay/poll/route.ts` | `server/src/app/api/relay/poll/route.ts` | **Port + modify** | Change auth from `validateDeviceSecret()` to `validateDeviceToken()`. Device identity comes from token lookup, not query param. Long-poll logic unchanged. |
| `app/api/relay/respond/route.ts` | `server/src/app/api/relay/respond/route.ts` | **Port + modify** | Same auth change. Remove legacy fields. Core logic unchanged. |
| `app/api/relay/register/route.ts` | `server/src/app/api/relay/register/route.ts` | **Rewrite** | Shared secret auth -> setup code validation. Simple `registerDevice(name)` -> full metadata storage + token generation. |
| `app/api/telegram/webhook/route.ts` | `server/src/app/api/telegram/webhook/route.ts` | **Port + modify** | Remove hardcoded `DEVICE_LABELS`. Dynamic /start help text. Dynamic /status from registry. Reaction handling unchanged. |
| `app/api/telegram/setup/route.ts` | `server/src/app/api/telegram/setup/route.ts` | **Port + modify** | Change auth from `validateDeviceSecret()` to `validateMasterSecret()`. Logic unchanged. |
| `app/page.tsx` | `server/src/app/page.tsx` | **Port + modify** | Replace "Shiny Politoed" branding with env vars. Remove politoed.png. Keep visual structure. |
| `app/layout.tsx` | `server/src/app/layout.tsx` | **Port + modify** | Dynamic title from env var. |
| `relay-agent.sh` (170 lines bash) | `src/agent/agent.ts` + `executor.ts` + `protocol.ts` | **Rewrite in Node.js** | Same functionality: poll, execute, respond. Bash -> Node.js. Static env config -> JSON config from `~/.config/yuna/device.json`. Fixed 5s retry -> exponential backoff. No jq dependency. |
| _(no equivalent)_ | `server/src/lib/devices.ts` | **New** | Device registry CRUD. Central to the dynamic N-device architecture. |
| _(no equivalent)_ | `server/src/app/api/devices/route.ts` | **New** | Device list endpoint for CLI. |
| _(no equivalent)_ | `src/cli/*` (all files) | **New** | npm CLI: init wizard, device management, agent launcher. |
| _(no equivalent)_ | `src/shared/types.ts` | **New** | Shared TypeScript types. |

### Key Architectural Differences from Prototype

1. **Auth:** Single shared `DEVICE_SECRET` env var -> per-device UUID tokens stored in Redis. Enables device revocation without affecting other devices.
2. **Device registry:** Hardcoded `DEVICE_LABELS = {uconsole, mac}` -> dynamic Redis registry (`yuna:devices` SET + `yuna:device:{name}` HASH per device).
3. **Tool generation:** Static `DEVICE_TOOLS` array -> async `buildDeviceTools()` that queries registry on each Claude call.
4. **System prompt:** Hardcoded 2 device sections -> dynamic loop building N device sections from registry metadata.
5. **Device agent:** Bash script (`relay-agent.sh`, 170 lines) -> Node.js module (`agent.ts` + `executor.ts` + `protocol.ts`, ~300 lines total).
6. **Configuration:** `.env` file + CLI flags -> `~/.config/yuna/*.json` managed by CLI wizard.
7. **Onboarding:** Manual env var setup -> `npx yuna-bot init` wizard with guided steps.
8. **Setup codes:** No equivalent in prototype -> one-time `XXXX-XXXX` codes with 10min TTL for secure device registration.

## Conventions

- TypeScript strict mode everywhere
- `yuna:` Redis key prefix (never `relay:`)
- Server routes: `/api/relay/*` (device endpoints), `/api/telegram/*` (Telegram endpoints), `/api/devices/*` (admin endpoints)
- Verify syntax after editing: `npx tsc --noEmit` for TypeScript
- The server is a Next.js 15 app (App Router) deployed to Vercel
- The CLI is built with tsup, output to `dist/`, entry point at `bin/yuna.js`
- Config files live in `~/.config/yuna/` (JSON format, chmod 600 for files with secrets)
