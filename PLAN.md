# Yuna — Implementation Plan & Status

## Context

Yuna is a self-hosted distributable version of Shiny Politoed. npm CLI + Vercel server lets anyone run their own AI-powered Telegram orchestrator across multiple devices. Per-device tokens, dynamic N devices, optional mesh networking.

- **Repo**: github.com/mikevitelli/yuna
- **npm**: [`yuna-bot@0.1.0`](https://www.npmjs.com/package/yuna-bot) — published 2026-04-13
- **Domain**: yuna.bot (not yet connected)
- **Platform**: Claude Haiku + Vercel + Upstash Redis + Telegram
- **First live deployment**: Luigi (@Luigi_041226_bot → https://luigi-eta.vercel.app), running for mikevitelli's uConsole

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

### ✅ Phase 1: End-to-end test — DONE (2026-04-13)

Proven live against @Luigi_041226_bot / luigi-eta.vercel.app:

- Wizard ran end-to-end with pre-flight checks + resume file (we hit multiple
  failure modes and recovered cleanly without re-entering secrets).
- Device registration via `/create-code` → `yuna add-device --code` → token
  issued → `~/.config/yuna/device.json` written.
- Agent polled `/api/relay/poll`, received commands, executed them, and posted
  results to `/api/relay/respond`.
- Full agentic loop verified: Luigi answered `/start`, `/status`, direct
  questions, and tool-routed commands ("give me system analytics") — chaining
  across `uptime`, `free`, `df`, `top` on the uConsole.
- Edge case: server-side Claude invoking device-side `claude` CLI over the
  relay worked as designed (proved the dispatch is truly transparent — any
  bash is bash).
- Timeout bump 30s → 60s shipped after observing exit 124 on nested LLM calls.

Remaining unproven in live test:
- 🔲 Confirmation gate UX — code shipped, not yet exercised in Telegram.
  Test by asking Luigi to delete a tmpfile and reacting 👍 / ❌.
- 🔲 Mesh `transfer_file` — only one device registered.
- 🔲 Multi-device routing — same reason.

### Phase 1.5: Historical test plan (superseded by actual run)

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

- ✅ **README.md** — rewritten in shiny-politoed style (badges, mermaid sequence /
  architecture / dataflow diagrams, feature table, cost table, Redis schema,
  security section, full project layout). Landed 2026-04-12.
- 🔲 **Landing page** — `server/src/app/page.tsx` still generic. Needs
  marketing-quality layout (logo, architecture diagram, install command, docs
  link). Optional split to `mikevitelli/yuna-landing` deployed at
  `www.yuna.bot`. Not blocking anything — deferred to v0.2.
- 🔲 **Docs site** — README + CLAUDE.md is enough for v0.1. Revisit if external
  contributors start landing.

### ✅ Phase 4: npm publish — DONE (2026-04-13)

- ✅ npm login via granular access token scoped to `yuna-bot` (2FA bypass,
  90-day expiry, installed to `~/.npmrc` chmod 600)
- ✅ `npm publish --access public` → `yuna-bot@0.1.0` live at
  https://www.npmjs.com/package/yuna-bot
- ✅ Smoke test from a fresh tmpdir: `npx -y yuna-bot@0.1.0 --help` downloads
  from the registry and runs cleanly, printing all 8 commands
- ✅ Tarball sanity: 36 files, 64 kB packed, 238 kB unpacked (down from the
  10,244-file bloat caught by a last-minute `npm pack --dry-run` — see the
  `fix(publish): narrow files whitelist` commit)
- 🔲 Connect `yuna.bot` custom domain to the Vercel landing page — deferred
- 🔲 v0.1.1 patch release once confirmation gate has been exercised end-to-end
  in Telegram (the code is live, the UX is unverified)

### Phase 4.5: Wizard UX polish (from first real run, 2026-04-12)

Discovered while running `yuna init` against a live Vercel account for the first time. None block E2E testing, but all should land before npm publish.

- **Use aliased production URL, not deployment URL** — `deployToVercel()` currently regex-matches the first `https://*.vercel.app` in `vercel deploy` output, which is the immutable deployment URL (`luigi-64z0r7lua-chopcheese.vercel.app`). That URL is subject to "Protection for Deployment URLs" even when Vercel Authentication is off, so Telegram's webhook bounces off an SSO page. The correct URL is the `Aliased: ` line (`luigi-eta.vercel.app`) — prefer that match. Fallback to the deployment URL only if no alias is found.

- **Detect + disable Deployment Protection programmatically** — even after switching to the alias, new Vercel projects can default to SSO-protected. Either (a) use the Vercel REST API during `init` to disable protection on the project, or (b) detect it via a probe `curl` of `/api/health` after deploy and print a clear message: *"Your project has Deployment Protection enabled. Disable it at https://vercel.com/<team>/<project>/settings/deployment-protection — the webhook is already secured by TELEGRAM_WEBHOOK_SECRET."*

- **Per-stage deploy progress output** — right now `deployToVercel()` pipes stdout to capture the URL, so users see ~3 minutes of silence between "Linked to project" and the final URL. Split into visible stages:
  1. `ora("Linking Vercel project...")` → show `vercel link` output live (already done via `stdio: "inherit"`)
  2. `ora("Setting environment variables (8)...")` → tick per var: `✓ TELEGRAM_BOT_TOKEN`, etc.
  3. `ora("Deploying...")` → tail `vercel deploy --prod` stdout to stderr/spinner text so users see build progress
  4. Final `✓ Deployed to <url>`
  - Implementation: stream stdout line-by-line via `spawn()` instead of `spawnSync()`, pipe through the ora spinner's text, parse the URL from the last matching line.

- **`yuna upgrade` command** — for when `yuna-bot` ships a new server template. Runs `vercel deploy --prod` from the freshly bundled template against the already-linked project (reads serverUrl from `~/.config/yuna/config.json`, finds or re-creates `.vercel/project.json`). No re-asking for secrets. This is how users get server updates without forking a git repo.

- **Interactive fallback when link ambiguous** — `vercel link --yes` currently works because the user has a clear default scope. If a user has multiple teams, `--yes` may still pick the wrong one. Consider dropping `--yes` on `link` and letting Vercel's interactive scope picker run.

- **Resume file housekeeping** — currently `.init-resume.json` is only cleared on full success. If a user abandons init for good (chooses a different deploy path, etc.), the file lingers. Add `yuna init --fresh` to force-clear before starting, and prune the file on clean `SIGINT` if the user hasn't entered anything yet.

- **Rename the temp deploy dir cleanup** — `.yuna-deploy-<slug>/` is left behind in cwd after a successful init. Either move it to `~/.cache/yuna/deploy/<slug>/` (honoring `XDG_CACHE_HOME`) so it's out of the user's workspace, or delete it after success (but keep `.vercel/` contents since they're needed for future `yuna upgrade`).

- **Clearer deploy-mode preflight** — if auto-deploy is picked but the user isn't logged into Vercel, we run `vercel login` (opens browser). Works, but the message says "Running `vercel login`..." without warning that a browser tab is about to open. Add: "A browser will open for Vercel authentication — come back here when done."

- **Better bot-name → Vercel project-name feedback** — slugification is silent. Tell the user: `Bot name "Luigi" → Vercel project slug "luigi"`. Prevents the "why is my project called yuna-deploy" confusion from first run.

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
