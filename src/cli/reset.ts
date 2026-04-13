import type { Command } from "commander";
import chalk from "chalk";
import { promptConfirm } from "./helpers/prompts.js";

export function registerReset(program: Command): void {
  program
    .command("reset")
    .description("Clear conversation history")
    .option("-y, --yes", "Skip confirmation")
    .action(runReset);
}

async function runReset(options: { yes?: boolean }): Promise<void> {
  if (!options.yes) {
    const ok = await promptConfirm("Clear conversation history?", false);
    if (!ok) return;
  }

  console.log(chalk.yellow("To reset conversation, send ") + chalk.bold("/reset") + chalk.yellow(" to your bot on Telegram."));
}
