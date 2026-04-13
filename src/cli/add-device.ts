import type { Command } from "commander";

/**
 * `yuna add-device` — Register this machine as a device.
 *
 * TODO: Implement the add-device flow:
 * 1. Require --code flag with a one-time setup code (from `yuna create-code`)
 * 2. Prompt for device name (e.g. "laptop", "raspberry-pi")
 * 3. Auto-detect OS, prompt to confirm
 * 4. Prompt for description (optional)
 * 5. Prompt for capabilities (e.g. ["bash", "systemd", "docker", "node"])
 * 6. Ask if device can SSH to other registered devices
 *    - If yes: for each known device, prompt for SSH alias
 * 7. POST to /api/relay/register with setup code + device info
 * 8. Server validates code (single-use, not expired), generates device token
 * 9. Write ~/.config/yuna/device.json (serverUrl + deviceToken + deviceName)
 * 10. Print success + "Run `yuna start` to begin listening"
 */
export function registerAddDevice(program: Command): void {
  program
    .command("add-device")
    .description("Register this machine as a device")
    .requiredOption("--code <code>", "One-time setup code from `yuna create-code`")
    .action(async (_options) => {
      // TODO: implement add-device flow
      throw new Error("TODO: implement add-device command");
    });
}
