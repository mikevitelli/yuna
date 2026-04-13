import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { spawnSync } from "child_process";
import { existsSync, cpSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { promptText, promptConfirm, promptSelect, promptSecret } from "./helpers/prompts.js";
import { saveConfig } from "./helpers/config.js";
import { generateSecret, hashSecret } from "./helpers/crypto.js";
import { openInBrowser } from "./helpers/browser.js";
import { validateBotToken, setWebhook as setTelegramWebhook } from "./helpers/telegram.js";
import {
  isVercelInstalled,
  isVercelLoggedIn,
  vercelLogin,
  deployToVercel,
} from "./helpers/vercel.js";

interface InitOptions {
  manual?: boolean;
  mcp?: boolean;
}

export function registerInit(program: Command): void {
  program
    .command("init")
    .description("Deploy server and configure bot")
    .option("--manual", "Scaffold server locally without auto-deploying")
    .option("--mcp", "Use MCP integrations where available (TODO)")
    .action(runInit);
}

async function runInit(options: InitOptions): Promise<void> {
  banner();

  // ─── Basic identity ────────────────────────────────────────────────
  const botName = await promptText("What should your bot be called?", {
    default: "Yuna",
  });
  const ownerName = await promptText("Your name (for the system prompt):", {
    default: detectGitUserName(),
  });

  // ─── Telegram ──────────────────────────────────────────────────────
  section("Telegram");
  const hasBot = await promptConfirm(
    "Do you already have a Telegram bot token from @BotFather?",
    false
  );
  if (!hasBot) {
    console.log(
      chalk.dim("Opening https://t.me/BotFather — send /newbot, choose a name, save the token.")
    );
    await openInBrowser("https://t.me/BotFather");
  }

  let botToken = "";
  let botUsername = "";
  for (;;) {
    botToken = await promptSecret("Paste your bot token:");
    const info = await validateBotToken(botToken);
    if (info) {
      botUsername = info.username;
      console.log(chalk.green("✓") + ` Connected to @${info.username}`);
      break;
    }
    console.log(chalk.red("Invalid token. Try again."));
  }

  const ownerId = await promptText(
    "Your Telegram user ID (get from @userinfobot):",
    { validate: (v) => /^\d+$/.test(v) || "must be a numeric ID" }
  );

  // ─── Anthropic API key ─────────────────────────────────────────────
  section("Anthropic API Key");
  const hasKey = await promptConfirm("Do you already have an Anthropic API key?", false);
  if (!hasKey) {
    console.log(chalk.dim("Opening https://console.anthropic.com/settings/keys"));
    await openInBrowser("https://console.anthropic.com/settings/keys");
  }
  const anthropicKey = await promptSecret("Paste your Anthropic API key:");
  if (!anthropicKey.startsWith("sk-ant-")) {
    console.log(chalk.yellow("Warning: key doesn't start with sk-ant-, continuing anyway"));
  }

  // ─── Upstash Redis ─────────────────────────────────────────────────
  section("Upstash Redis");
  const hasRedis = await promptConfirm(
    "Do you already have an Upstash Redis database?",
    false
  );
  if (!hasRedis) {
    console.log(
      chalk.dim("Opening https://console.upstash.com — create a free database, copy REST URL and token.")
    );
    await openInBrowser("https://console.upstash.com");
  }
  const redisUrl = await promptText("Upstash REST URL:", {
    validate: (v) => /^https:\/\//.test(v) || "must start with https://",
  });
  const redisToken = await promptSecret("Upstash REST token:");

  // ─── Secrets ───────────────────────────────────────────────────────
  const masterSecret = generateSecret(32);
  const webhookSecret = generateSecret(16);

  // ─── Deploy ────────────────────────────────────────────────────────
  section("Deploy");
  const manual =
    options.manual ||
    (await promptSelect("Deployment mode:", [
      { name: "Auto-deploy to Vercel (recommended)", value: "auto" },
      { name: "Scaffold locally (manual deploy)", value: "manual" },
    ])) === "manual";

  const envVars = {
    TELEGRAM_BOT_TOKEN: botToken,
    TELEGRAM_OWNER_ID: ownerId,
    TELEGRAM_WEBHOOK_SECRET: webhookSecret,
    UPSTASH_REDIS_REST_URL: redisUrl,
    UPSTASH_REDIS_REST_TOKEN: redisToken,
    ANTHROPIC_API_KEY: anthropicKey,
    BOT_NAME: botName,
    OWNER_NAME: ownerName,
  };

  const serverTemplatePath = findServerTemplate();
  if (!serverTemplatePath) {
    console.error(chalk.red("Could not locate bundled server/ template."));
    process.exit(1);
  }

  let serverUrl = "";

  if (manual) {
    const dest = join(process.cwd(), "yuna-server");
    cpSync(serverTemplatePath, dest, { recursive: true });
    writeFileSync(
      join(dest, ".env.local"),
      Object.entries(envVars)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") + "\n"
    );
    console.log(chalk.green("✓") + ` Scaffolded to ${dest}`);
    console.log("");
    console.log("Next steps:");
    console.log(`  ${chalk.bold("cd yuna-server")}`);
    console.log(`  ${chalk.bold("npm install")}`);
    console.log(`  ${chalk.bold("vercel deploy --prod")}`);
    serverUrl = await promptText(
      "Once deployed, paste the Vercel URL (e.g. https://my-yuna.vercel.app):",
      {
        validate: (v) =>
          /^https:\/\//.test(v) || "must start with https://",
      }
    );
  } else {
    // Auto-deploy
    if (!(await isVercelInstalled())) {
      console.error(chalk.red("Vercel CLI not installed. Install with: npm i -g vercel"));
      process.exit(1);
    }
    if (!(await isVercelLoggedIn())) {
      console.log(chalk.dim("Logging into Vercel..."));
      await vercelLogin();
    }
    const spinner = ora("Deploying to Vercel...").start();
    try {
      const dest = join(process.cwd(), ".yuna-deploy");
      cpSync(serverTemplatePath, dest, { recursive: true });
      serverUrl = await deployToVercel(dest, envVars);
      spinner.succeed(`Deployed to ${serverUrl}`);
    } catch (e) {
      spinner.fail("Deployment failed");
      console.error(chalk.red((e as Error).message));
      process.exit(1);
    }
  }

  // ─── Store master secret in Redis ──────────────────────────────────
  section("Finalizing");
  const masterSpinner = ora("Storing master secret...").start();
  try {
    await upstashSet(redisUrl, redisToken, "yuna:master", hashSecret(masterSecret));
    masterSpinner.succeed("Master secret stored");
  } catch (e) {
    masterSpinner.fail("Failed to store master secret");
    console.error(chalk.red((e as Error).message));
    process.exit(1);
  }

  // ─── Register Telegram webhook ─────────────────────────────────────
  const webhookSpinner = ora("Registering Telegram webhook...").start();
  const webhookOk = await setTelegramWebhook(
    botToken,
    `${serverUrl}/api/telegram/webhook`,
    webhookSecret
  );
  if (webhookOk) {
    webhookSpinner.succeed("Telegram webhook registered");
  } else {
    webhookSpinner.fail("Failed to register Telegram webhook");
  }

  // ─── Save local config ─────────────────────────────────────────────
  saveConfig({
    botName,
    ownerName,
    serverUrl,
    masterSecretHash: hashSecret(masterSecret),
  });

  // ─── Success ───────────────────────────────────────────────────────
  console.log("");
  console.log(chalk.green.bold("✓ Yuna ready!"));
  console.log("");
  console.log(`Bot: @${chalk.bold(botUsername)}`);
  console.log(`Server: ${chalk.bold(serverUrl)}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  1. Send ${chalk.bold("/create-code")} to your bot on Telegram`);
  console.log(`  2. On each device, run: ${chalk.bold("yuna add-device --code <code>")}`);
  console.log(`  3. Run ${chalk.bold("yuna start")} on each device`);
  console.log("");
  console.log(chalk.dim(`Master secret (save this, only shown once): ${masterSecret}`));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function banner(): void {
  console.log("");
  console.log(chalk.bold.cyan("  Yuna"));
  console.log(chalk.dim("  AI-powered multi-device orchestrator over Telegram"));
  console.log("");
}

function section(title: string): void {
  console.log("");
  console.log(chalk.bold.cyan(`── ${title} ──`));
}

function detectGitUserName(): string {
  try {
    const r = spawnSync("git", ["config", "user.name"], { encoding: "utf-8" });
    return r.stdout.trim() || "the user";
  } catch {
    return "the user";
  }
}

function findServerTemplate(): string | null {
  // When installed via npm, the server/ dir lives alongside dist/
  // When running from source, it's at the repo root.
  const thisFile = fileURLToPath(import.meta.url);
  const candidates = [
    join(dirname(thisFile), "..", "..", "server"), // dist/cli → repo root
    join(dirname(thisFile), "..", "..", "..", "server"), // when bundled deeper
    join(process.cwd(), "server"),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, "package.json"))) return c;
  }
  return null;
}

async function upstashSet(
  restUrl: string,
  token: string,
  key: string,
  value: string
): Promise<void> {
  const res = await fetch(`${restUrl}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
  });
  if (!res.ok) {
    throw new Error(`Upstash SET failed: HTTP ${res.status}`);
  }
}
