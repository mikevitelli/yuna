import type { Command } from "commander";

/**
 * `yuna reset` — Clear conversation history.
 *
 * TODO: Implement:
 * 1. Load config (serverUrl)
 * 2. Confirm with user (unless --yes flag)
 * 3. POST to server endpoint to clear yuna:conversation:messages in Redis
 * 4. Display success message
 */
export function registerReset(program: Command): void {
  program
    .command("reset")
    .description("Clear conversation history")
    .option("--yes", "Skip confirmation prompt")
    .action(async (_options) => {
      // TODO: implement conversation reset
      throw new Error("TODO: implement reset command");
    });
}
