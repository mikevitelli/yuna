import type { Command } from "commander";

/**
 * `yuna status` — Show server health + device list.
 *
 * TODO: Implement:
 * 1. Load config (serverUrl from config.json or device.json)
 * 2. GET /api/health — show server status
 * 3. GET /api/devices — list all registered devices with online/offline status
 * 4. Display as formatted table with chalk
 */
export function registerStatus(program: Command): void {
  program
    .command("status")
    .description("Show server health and device list")
    .action(async () => {
      // TODO: implement status display
      throw new Error("TODO: implement status command");
    });
}
