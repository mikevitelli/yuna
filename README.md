# Yuna

AI-powered multi-device orchestrator over Telegram. Self-hosted.

Send a message from your phone. Claude on the server decides what to do — answer directly, or run commands on your devices. Devices are just hands. You pick the character.

## Install

```bash
npx yuna-bot init
```

## How it works

```
Telegram → Vercel (Claude Haiku + tool_use) → Redis Streams → Device agent executes → Result back → Telegram
```

- **Server**: Next.js on Vercel, calls Claude API with tool_use
- **Devices**: Lightweight Node.js agents that poll for commands and execute them
- **State**: Upstash Redis for conversation history, message queues, device registry
- **Auth**: Per-device tokens, Telegram owner lock, webhook secret

No Tailscale. No VPN. No port forwarding. Devices just need internet.

## Commands

```
yuna init          # Deploy your server, configure bot
yuna add-device    # Register a device
yuna start         # Run device agent
yuna status        # Check server + devices
yuna reset         # Clear conversation
```

## Self-hosted

You deploy your own Vercel instance. You use your own Anthropic API key. You use your own Upstash Redis. Nothing is shared. Your data stays yours.

## Status

Under development.
