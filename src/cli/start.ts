import type { Command } from "commander";
import chalk from "chalk";
import { loadDeviceConfig } from "./helpers/config.js";
import { startAgent } from "../agent/agent.js";

export function registerStart(program: Command): void {
  program
    .command("start")
    .description("Run device agent (foreground)")
    .action(runStart);
}

async function runStart(): Promise<void> {
  const config = loadDeviceConfig();
  if (!config) {
    console.error(
      chalk.red("No device config found. Run `yuna add-device --code <code>` first.")
    );
    process.exit(1);
  }

  const controller = new AbortController();

  const shutdown = (signal: string) => {
    console.log(`\n${chalk.yellow(`Received ${signal}, shutting down...`)}`);
    controller.abort();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await startAgent({ config, signal: controller.signal });
  } catch (e) {
    console.error(chalk.red(`Agent error: ${(e as Error).message}`));
    process.exit(1);
  }
}
