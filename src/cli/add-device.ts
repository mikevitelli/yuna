import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { platform } from "os";
import { promptText, promptConfirm } from "./helpers/prompts.js";
import { saveDeviceConfig } from "./helpers/config.js";
import { apiCall } from "./helpers/api.js";

interface AddDeviceOptions {
  code: string;
  url?: string;
  name?: string;
  yes?: boolean;
}

export function registerAddDevice(program: Command): void {
  program
    .command("add-device")
    .description("Register this machine as a device")
    .requiredOption("--code <code>", "One-time setup code")
    .option("--url <url>", "Yuna server URL (required on fresh machines)")
    .option("--name <name>", "Device name")
    .option("-y, --yes", "Skip confirmation prompts, use defaults")
    .action(runAddDevice);
}

async function runAddDevice(options: AddDeviceOptions): Promise<void> {
  // Determine server URL
  let serverUrl = options.url;
  if (!serverUrl) {
    serverUrl = await promptText("Yuna server URL:", {
      validate: (v) =>
        /^https?:\/\//.test(v) || "must start with http:// or https://",
    });
  }
  serverUrl = serverUrl.replace(/\/$/, "");

  // Device name
  let name = options.name;
  if (!name) {
    name = await promptText("Device name (lowercase, e.g. laptop):", {
      default: detectDefaultName(),
      validate: (v) =>
        /^[a-z0-9][a-z0-9-]{0,30}$/.test(v) ||
        "lowercase alphanumeric + hyphens, max 31 chars",
    });
  }

  const os = detectOS();
  const description = options.yes
    ? ""
    : await promptText("Description (optional):", { default: "" });

  // Register with server
  const spinner = ora("Registering device with server...").start();
  try {
    const res = await apiCall<{ ok: boolean; device: string; token: string }>(
      serverUrl,
      "/api/relay/register",
      {
        method: "POST",
        body: {
          code: options.code,
          name,
          os,
          description,
          capabilities: [],
          ssh: {},
        },
      }
    );

    spinner.succeed("Device registered");

    // Save device config
    saveDeviceConfig({
      serverUrl,
      deviceToken: res.token,
      deviceName: res.device,
    });

    console.log("");
    console.log(chalk.green("✓") + ` Device "${chalk.bold(res.device)}" ready`);
    console.log("");
    console.log(`Run ${chalk.bold("yuna start")} to begin listening.`);
  } catch (e) {
    spinner.fail("Registration failed");
    console.error(chalk.red(e instanceof Error ? e.message : String(e)));
    process.exit(1);
  }
}

function detectOS(): string {
  const p = platform();
  if (p === "linux") return "linux";
  if (p === "darwin") return "macos";
  if (p === "win32") return "windows";
  return p;
}

function detectDefaultName(): string {
  // Use the hostname, sanitized
  try {
    const hostname = require("os").hostname() as string;
    return hostname
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 31);
  } catch {
    return "device";
  }
}
