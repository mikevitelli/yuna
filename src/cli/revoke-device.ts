import type { Command } from "commander";
import chalk from "chalk";

export function registerRevokeDevice(program: Command): void {
  program
    .command("revoke-device <name>")
    .description("Revoke a device's auth token")
    .action(runRevokeDevice);
}

async function runRevokeDevice(name: string): Promise<void> {
  console.log(chalk.yellow(`To revoke "${name}", send `) + chalk.bold(`/revoke ${name}`) + chalk.yellow(" to your bot on Telegram."));
}
