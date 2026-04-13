import type { Command } from "commander";
import chalk from "chalk";
import { loadConfig, loadDeviceConfig } from "./helpers/config.js";
import { apiCall } from "./helpers/api.js";

interface DeviceWithStatus {
  name: string;
  os: string;
  description: string;
  online: boolean;
  lastSeen: string | null;
}

export function registerStatus(program: Command): void {
  program
    .command("status")
    .description("Show server health and device list")
    .action(runStatus);
}

async function runStatus(): Promise<void> {
  const config = loadConfig();
  const deviceConfig = loadDeviceConfig();

  const serverUrl = config?.serverUrl || deviceConfig?.serverUrl;
  const token = deviceConfig?.deviceToken;

  if (!serverUrl) {
    console.error(chalk.red("No config found. Run `yuna init` or `yuna add-device` first."));
    process.exit(1);
  }

  // Health
  try {
    const health = await apiCall<{ status: string; redis: string }>(
      serverUrl,
      "/api/health",
      { timeout: 5000 }
    );
    console.log(
      chalk.green("✓") +
        ` Server ${chalk.bold(health.status)} (Redis: ${health.redis})`
    );
  } catch (e) {
    console.log(chalk.red("✗") + ` Server unreachable: ${(e as Error).message}`);
    return;
  }

  // Devices — requires auth
  if (!token) {
    console.log(chalk.dim("\n(install a device with `yuna add-device` to see device list)"));
    return;
  }

  try {
    const { devices } = await apiCall<{ devices: DeviceWithStatus[] }>(
      serverUrl,
      "/api/devices",
      { token }
    );

    if (devices.length === 0) {
      console.log(chalk.dim("\nNo devices registered."));
      return;
    }

    console.log("\n" + chalk.bold("Devices:"));
    for (const d of devices) {
      const dot = d.online ? chalk.green("●") : chalk.red("●");
      const ago = d.lastSeen ? timeSince(new Date(d.lastSeen)) : "never";
      console.log(
        `  ${dot} ${chalk.bold(d.name)} ${chalk.dim(`(${d.os})`)} — seen ${ago}`
      );
      if (d.description) {
        console.log(`    ${chalk.dim(d.description)}`);
      }
    }
  } catch (e) {
    console.error(chalk.red(`Failed to fetch devices: ${(e as Error).message}`));
  }
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
