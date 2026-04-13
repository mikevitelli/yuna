import type { Command } from "commander";

/**
 * `yuna create-code` — Generate a one-time setup code for adding devices.
 *
 * TODO: Implement:
 * 1. Load ~/.config/yuna/config.json (requires admin access / master secret)
 * 2. POST to server to create a setup code in Redis (10min TTL, single-use)
 * 3. Display the code: "Setup code: ABCD-1234 (expires in 10 minutes)"
 * 4. The code format is XXXX-XXXX (alphanumeric uppercase)
 */
export function registerCreateCode(program: Command): void {
  program
    .command("create-code")
    .description("Generate one-time setup code for adding devices")
    .action(async () => {
      // TODO: implement setup code generation
      throw new Error("TODO: implement create-code command");
    });
}
