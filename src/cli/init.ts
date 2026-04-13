import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { spawnSync } from "child_process";
import { existsSync, cpSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { promptText, promptConfirm, promptSelect, promptSecret } from "./helpers/prompts.js";
import {
  saveConfig,
  loadInitResume,
  saveInitResume,
  clearInitResume,
  type InitResume,
} from "./helpers/config.js";
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

  // ─── Resume from previous run? ─────────────────────────────────────
  let resume: InitResume = loadInitResume() ?? {};
  if (Object.keys(resume).length > 0) {
    console.log(
      chalk.yellow("Found a previous incomplete init (resume file).")
    );
    const doResume = await promptConfirm(
      "Resume from where you left off? (No starts fresh and discards saved answers)",
      true
    );
    if (!doResume) {
      clearInitResume();
      resume = {};
    } else {
      const known: string[] = [];
      if (resume.botName) known.push(`bot="${resume.botName}"`);
      if (resume.botUsername) known.push(`@${resume.botUsername}`);
      if (resume.ownerId) known.push(`owner=${resume.ownerId}`);
      if (resume.redisUrl) known.push("redis ✓");
      if (resume.anthropicKey) known.push("anthropic ✓");
      if (known.length) console.log(chalk.dim(`  Using: ${known.join(", ")}`));
    }
  }

  const persist = (patch: Partial<InitResume>) => {
    resume = { ...resume, ...patch };
    saveInitResume(resume);
  };

  // ─── Deploy mode + preflight (FAIL FAST before collecting secrets) ─
  section("Deployment mode");
  const manual =
    options.manual ||
    resume.deployMode === "manual" ||
    (await promptSelect("How do you want to deploy the server?", [
      { name: "Auto-deploy to Vercel (requires vercel CLI)", value: "auto" },
      { name: "Scaffold locally, deploy yourself later", value: "manual" },
    ])) === "manual";
  persist({ deployMode: manual ? "manual" : "auto" });

  if (!manual) {
    const preflightSpinner = ora("Checking Vercel CLI...").start();
    if (!(await isVercelInstalled())) {
      preflightSpinner.fail("Vercel CLI not found on PATH");
      console.log("");
      console.log("Install it first:");
      console.log(`  ${chalk.bold("sudo npm i -g vercel")}`);
      console.log("");
      console.log(
        `Or re-run with ${chalk.bold("--manual")} to scaffold the server and deploy yourself.`
      );
      process.exit(1);
    }
    if (!(await isVercelLoggedIn())) {
      preflightSpinner.warn("Vercel CLI installed but not logged in");
      console.log(chalk.dim("Running `vercel login`..."));
      try {
        await vercelLogin();
      } catch (e) {
        console.error(chalk.red((e as Error).message));
        process.exit(1);
      }
    } else {
      preflightSpinner.succeed("Vercel CLI ready");
    }
  }

  // ─── Basic identity ────────────────────────────────────────────────
  const botName =
    resume.botName ??
    (await promptText("What should your bot be called?", { default: "Yuna" }));
  persist({ botName });

  const ownerName =
    resume.ownerName ??
    (await promptText("Your name (for the system prompt):", {
      default: detectGitUserName(),
    }));
  persist({ ownerName });

  // ─── Telegram ──────────────────────────────────────────────────────
  section("Telegram");
  let botToken = resume.botToken ?? "";
  let botUsername = resume.botUsername ?? "";
  if (!botToken || !botUsername) {
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
    persist({ botToken, botUsername });
  } else {
    console.log(chalk.green("✓") + ` Using saved bot @${botUsername}`);
  }

  const ownerId =
    resume.ownerId ??
    (await promptText("Your Telegram user ID (get from @userinfobot):", {
      validate: (v) => /^\d+$/.test(v) || "must be a numeric ID",
    }));
  persist({ ownerId });

  // ─── Anthropic API key ─────────────────────────────────────────────
  let anthropicKey = resume.anthropicKey ?? "";
  if (!anthropicKey) {
    section("Anthropic API Key");
    const hasKey = await promptConfirm("Do you already have an Anthropic API key?", false);
    if (!hasKey) {
      console.log(chalk.dim("Opening https://console.anthropic.com/settings/keys"));
      await openInBrowser("https://console.anthropic.com/settings/keys");
    }
    anthropicKey = await promptSecret("Paste your Anthropic API key:");
    if (!anthropicKey.startsWith("sk-ant-")) {
      console.log(chalk.yellow("Warning: key doesn't start with sk-ant-, continuing anyway"));
    }
    persist({ anthropicKey });
  } else {
    console.log(chalk.green("✓") + " Using saved Anthropic key");
  }

  // ─── Upstash Redis ─────────────────────────────────────────────────
  let redisUrl = resume.redisUrl ?? "";
  let redisToken = resume.redisToken ?? "";
  if (!redisUrl || !redisToken) {
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
    redisUrl = await promptText("Upstash REST URL:", {
      validate: (v) => /^https:\/\//.test(v) || "must start with https://",
    });
    redisToken = await promptSecret("Upstash REST token:");
    persist({ redisUrl, redisToken });
  } else {
    console.log(chalk.green("✓") + " Using saved Upstash credentials");
  }

  // ─── Secrets ───────────────────────────────────────────────────────
  const masterSecret = resume.masterSecret ?? generateSecret(32);
  const webhookSecret = resume.webhookSecret ?? generateSecret(16);
  persist({ masterSecret, webhookSecret });

  // ─── Deploy ────────────────────────────────────────────────────────
  section("Deploy");

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

  let serverUrl = resume.serverUrl ?? "";

  if (manual) {
    if (!serverUrl) {
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
          validate: (v) => /^https:\/\//.test(v) || "must start with https://",
        }
      );
      persist({ serverUrl });
    } else {
      console.log(chalk.green("✓") + ` Using saved server URL: ${serverUrl}`);
    }
  } else {
    console.log(chalk.dim("Launching `vercel link` + `vercel deploy --prod` — answer any prompts below."));
    console.log("");
    try {
      const slug = slugify(botName);
      const dest = join(process.cwd(), `.yuna-deploy-${slug}`, slug);
      cpSync(serverTemplatePath, dest, { recursive: true });
      serverUrl = await deployToVercel(dest, envVars);
      console.log(chalk.green("✓") + ` Deployed to ${serverUrl}`);
      persist({ serverUrl });
    } catch (e) {
      console.error(chalk.red("Deployment failed: " + (e as Error).message));
      console.log("");
      console.log(
        chalk.dim(
          "Your answers are saved. Re-run `yuna init` to resume from the deploy step."
        )
      );
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

  clearInitResume();

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

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 52) || "yuna"
  );
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
