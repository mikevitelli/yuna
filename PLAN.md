# Yuna — Implementation Plan & Status

## Context

Yuna is a self-hosted distributable version of Shiny Politoed. npm CLI + Vercel server lets anyone run their own AI-powered Telegram orchestrator across multiple devices. Per-device tokens, dynamic N devices, optional mesh networking.

- **Repo**: github.com/mikevitelli/yuna
- **npm**: `yuna-bot` (not yet published)
- **Domain**: yuna.bot (not yet connected)
- **Platform**: Claude Haiku + Vercel + Upstash Redis + Telegram

---

## Status

### ✅ Done (v0.1 scaffold + implementation)

**Server** (`server/`) — all 8 lib modules + 7 API routes, type-clean, builds:
- `lib/redis.ts` — Streams with consumer group "agent", conversation pruning, orchestration tasks, audit log, XPENDING reclaim
- `lib/devices.ts` — CRUD with online status, lastSeen heartbeat
- `lib/auth.ts` — per-device UUID tokens, hashed master secret, one-time setup codes
- `lib/rate-limit.ts` — Redis sliding window
- `lib/telegram.ts` — sendMessage/Typing/edit, webhook verify, md→HTML
- `lib/tools.ts` — dynamic tool generation (run_on_{device}, read_file, write_file, transfer_file)
- `lib/system-prompt.ts` — dynamic device sections from Redis registry
- `lib/orchestrator.ts` — agentic loop with tool_use, offline fallback, model overrides
- `api/health/` — Redis ping
- `api/devices/` — list devices with status
- `api/relay/poll/` — long-poll with XREADGROUP, 25s hold
- `api/relay/respond/` — ACK stream, resume orchestration
- `api/relay/register/` — setup code validation, token issuance
- `api/telegram/webhook/` — /start /status /reset /create-code /revoke /logs, reactions, rate limiting
- `api/telegram/setup/` — one-time webhook registration with master secret auth

**CLI** (`src/cli/`) — 8 commands, type-clean, builds via tsup:
- `init.ts` — interactive wizard (Telegram → Anthropic → Upstash → Vercel auto-deploy or --manual)
- `add-device.ts` — OS detection, per-device token issuance, config write
- `start.ts` — agent launcher with graceful shutdown
- `status.ts` — server health + device list
- `reset.ts`, `create-code.ts`, `revoke-device.ts`, `logs.ts` — Telegram-command pointers
- Helpers: `config.ts`, `crypto.ts`, `browser.ts`, `telegram.ts`, `vercel.ts`, `prompts.ts`, `api.ts`

**Device agent** (`src/agent/`):
- `agent.ts` — polling loop, exponential backoff (1s→30s), abort signal handling
- `executor.ts` — bash/read_file/write_file/transfer_file with timeout + truncation
- `protocol.ts` — wire protocol types

**Other**:
- `CLAUDE.md` — 10-section implementation guide (read first in any new session)
- `tsconfig.json`, `tsup.config.ts`, `bin/yuna.js` shim
- `package.json` — yuna-bot, commander/inquirer/chalk/ora/open deps

---

## 🔲 Remaining work

### Phase 1: End-to-end test (highest priority)

Goal: prove the full pipeline works with a real deploy before publishing.

1. **Create test Vercel project**
   - `cd ~/yuna && node bin/yuna.js init`
   - OR: manual Vercel deploy of `server/` directory
   - Set env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_ID, TELEGRAM_WEBHOOK_SECRET, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, ANTHROPIC_API_KEY, BOT_NAME, OWNER_NAME
   - Use a **new Upstash Redis database** (don't share with shiny-politoed)
   - Use a **new Telegram bot** via @BotFather (don't reuse shiny-politoed's bot)

2. **Test device registration**
   - Run `node bin/yuna.js init` locally → walks through full wizard
   - Verify `~/.config/yuna/config.json` created
   - Send `/create-code` to the new bot → get setup code
   - Run `node bin/yuna.js add-device --code XXXX-YYYY` → registers, stores token
   - Verify `~/.config/yuna/device.json` created

3. **Test the agentic loop**
   - Run `node bin/yuna.js start` → agent begins polling
   - Send "what time is it" to Telegram → Claude answers directly (no tool use)
   - Send "check disk usage" → Claude uses `run_on_{device}` tool → agent executes `df -h` → result sent back to Telegram
   - Send "check battery and list home directory" → multi-step tool use, sequential dispatch
   - Test `@opus` / `@sonnet` model overrides
   - Test emoji reactions (👍, 🔄, ❌)
   - Test `/reset`, `/status`, `/logs`

4. **Test offline handling**
   - Kill the agent mid-task → verify orchestration task expires
   - Stop a device → verify Claude gets offline error tool_result and adapts

5. **Fix any bugs found** and re-test until green

### Phase 2: Mesh networking test (if phase 1 works)

1. Register a 2nd device (e.g. on your Mac)
2. Configure SSH aliases between them in device metadata (Redis `yuna:device:{name}.ssh`)
3. Test `transfer_file` tool — copy a file from device A to device B via SCP

### Phase 3: Distribution polish

1. **Landing page**
   - `server/src/app/page.tsx` — currently generic, add a marketing-quality page
   - Logo (not Politoed — generic/abstract), architecture diagram, install command, docs link
   - Optional: separate repo `mikevitelli/yuna-landing` deployed to `www.yuna.bot`

2. **README.md** — rewrite for npm/GitHub audience:
   - Quick install: `npm install -g yuna-bot && yuna init`
   - Architecture explanation
   - Self-hosted benefits (no data shared, bring your own API keys)
   - Link to landing page + docs

3. **Docs site** (optional, README + CLAUDE.md is enough for v0.1)

### Phase 4: npm publish

1. Connect `yuna.bot` custom domain to the Vercel landing page (optional)
2. `npm login` (if not already)
3. `npm publish --access public`
4. Test install from a fresh machine: `npm install -g yuna-bot && yuna init`

### Phase 5: Nice-to-haves (post-v0.1)

- **Stale task watchdog** — Vercel cron that detects expired orchestration tasks, notifies Telegram
- **Device capability auto-detect** — `yuna start` could auto-report installed tools
- **Windows native agent** — replace `bash -c` with cross-platform execution
- **Web admin dashboard** — currently Telegram-only
- **Conversation branching** — multiple parallel conversations

---

## How to pick this up in a new session

Start the session by reading (in order):

1. `CLAUDE.md` — architecture overview, file-by-file guide, Redis key reference, wire protocol, auth model
2. `PLAN.md` (this file) — status + remaining work
3. `README.md` — high-level intro

Then pick one of:

**A) Continue with end-to-end testing** (recommended next step)
```bash
cd ~/yuna
npm run build:cli
node bin/yuna.js --help
node bin/yuna.js init  # walks through full wizard
```

Work through Phase 1 step-by-step. Fix any bugs that surface. Commit fixes as you go.

**B) Start on landing page / README polish**
Work on `server/src/app/page.tsx` and root `README.md` before testing.

**C) Skip to npm publish**
Not recommended. Test first.

---

## File reference

### Source locations
- **Yuna repo**: `~/yuna/` (github.com/mikevitelli/yuna)
- **Shiny Politoed repo** (reference/working example): `~/claude-relay-repo/` (github.com/mikevitelli/shiny-politoed)
- **Shiny Politoed live**: `www.shiny-politoed.bot`

### Redis namespaces
- `yuna:*` — Yuna keys (use a **new** Upstash database)
- `relay:*` — Shiny Politoed keys (existing `natural-lemming-72692` instance)
- Keep them separate.

### Credentials — don't share between instances
- Telegram bot token (create a new @BotFather bot for Yuna)
- Anthropic API key (can reuse — same account)
- Upstash Redis URL+token (create new database)
- Vercel project (new deployment)

---

## Verification checklist

Before declaring v0.1 done:
- [x] `cd server && npx tsc --noEmit` passes
- [x] `cd server && npx next build` passes
- [x] `npx tsc --noEmit` (root) passes
- [x] `npm run build:cli` succeeds
- [x] `node bin/yuna.js --help` shows all 8 commands
- [ ] Full `yuna init` wizard runs without errors
- [ ] `yuna add-device --code X` registers successfully
- [ ] `yuna start` connects and polls
- [ ] Send message to Telegram bot → response received
- [ ] Multi-step tool use (e.g. "check battery then show processes")
- [ ] `/status`, `/reset`, `/create-code`, `/logs` work
- [ ] Emoji reactions trigger actions
- [ ] `transfer_file` works between 2 mesh-configured devices
- [ ] Published to npm
- [ ] Custom domain connected
