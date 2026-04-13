import type { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "./helpers/config.js";

export function registerCreateCode(program: Command): void {
  program
    .command("create-code")
    .description("Get instructions for generating a device setup code")
    .action(runCreateCode);
}

async function runCreateCode(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.error(chalk.red("No Yuna admin config found. Run `yuna init` first."));
    process.exit(1);
  }

  console.log(chalk.yellow("Setup codes are generated via Telegram:"));
  console.log(`  1. Send ${chalk.bold("/create-code")} to your bot`);
  console.log(`  2. Copy the code from the response`);
  console.log(
    `  3. Run ${chalk.bold("yuna add-device --code <code>")} on the new device`
  );
  console.log("");
  console.log(chalk.dim(`Server: ${config.serverUrl}`));
}
