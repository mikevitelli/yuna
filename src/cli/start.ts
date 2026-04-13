import type { Command } from "commander";

/**
 * `yuna start` — Run device agent on this machine.
 *
 * TODO: Implement the agent launcher:
 * 1. Load ~/.config/yuna/device.json (serverUrl, deviceToken, deviceName)
 * 2. Validate config exists, error if not registered
 * 3. Import and start the agent polling loop from src/agent/agent.ts
 * 4. Handle SIGINT/SIGTERM for graceful shutdown
 * 5. Support --daemon flag for background mode
 */
export function registerStart(program: Command): void {
  program
    .command("start")
    .description("Run device agent (foreground)")
    .option("--daemon", "Run device agent in the background")
    .action(async (_options) => {
      // TODO: implement agent launcher with graceful shutdown
      throw new Error("TODO: implement start command");
    });
}
