import type { Command } from "commander";

/**
 * `yuna init` — Deploy server, configure bot.
 *
 * TODO: Implement the init wizard:
 * 1. Welcome banner
 * 2. Prompt for bot name (default: "Yuna")
 * 3. Prompt for owner name (default: git config user.name)
 * 4. Telegram setup: prompt for bot token, validate via getMe API, prompt for owner user ID
 * 5. Anthropic API key: prompt, validate format (sk-ant-...)
 * 6. Redis: prompt for Upstash REST URL + token, test connection with ping
 * 7. Generate MASTER_SECRET + TELEGRAM_WEBHOOK_SECRET
 * 8. Deploy choice: Vercel auto-deploy or manual scaffold
 * 9. Store hashed MASTER_SECRET in Redis
 * 10. Register Telegram webhook
 * 11. Write ~/.config/yuna/config.json
 * 12. Print success + next steps
 *
 * Flags:
 *   --manual  Scaffold only, no auto-deploy
 *   --mcp     Use MCP integrations where available
 */
export function registerInit(program: Command): void {
  program
    .command("init")
    .description("Deploy server and configure bot")
    .option("--manual", "Scaffold server locally without auto-deploying")
    .option("--mcp", "Use MCP integrations where available")
    .action(async (_options) => {
      // TODO: implement init wizard
      throw new Error("TODO: implement init command");
    });
}
