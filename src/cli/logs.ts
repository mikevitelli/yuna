import type { Command } from "commander";

/**
 * `yuna logs` — Show recent audit log.
 *
 * TODO: Implement:
 * 1. Load config (serverUrl)
 * 2. GET /api/logs (or similar) — fetch recent entries from yuna:log LIST
 * 3. Display formatted log entries (timestamp, type, device, tool, command, exitCode)
 * 4. Support --limit N flag (default 20)
 * 5. Support --device <name> filter
 */
export function registerLogs(program: Command): void {
  program
    .command("logs")
    .description("Show recent audit log")
    .option("-n, --limit <count>", "Number of entries to show", "20")
    .option("-d, --device <name>", "Filter by device name")
    .action(async (_options) => {
      // TODO: implement audit log display
      throw new Error("TODO: implement logs command");
    });
}
