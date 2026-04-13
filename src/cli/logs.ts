import type { Command } from "commander";
import chalk from "chalk";

export function registerLogs(program: Command): void {
  program
    .command("logs")
    .description("Show recent audit log")
    .action(runLogs);
}

async function runLogs(): Promise<void> {
  console.log(
    chalk.yellow("To view logs, send ") +
      chalk.bold("/logs") +
      chalk.yellow(" to your bot on Telegram.")
  );
}
