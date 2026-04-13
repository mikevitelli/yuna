import type { Command } from "commander";

/**
 * `yuna revoke-device <name>` — Revoke a device's token.
 *
 * TODO: Implement:
 * 1. Load ~/.config/yuna/config.json (requires admin access)
 * 2. Confirm with user (unless --yes flag)
 * 3. POST to server to delete device token from Redis
 * 4. Remove device from yuna:devices set
 * 5. Delete yuna:device:{name}, yuna:token:{token}, yuna:stream:{name}
 * 6. Display success message
 */
export function registerRevokeDevice(program: Command): void {
  program
    .command("revoke-device <name>")
    .description("Revoke a device's auth token")
    .option("--yes", "Skip confirmation prompt")
    .action(async (_name, _options) => {
      // TODO: implement device revocation
      throw new Error("TODO: implement revoke-device command");
    });
}
