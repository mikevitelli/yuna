import { spawnSync, spawn } from "child_process";

export async function isVercelInstalled(): Promise<boolean> {
  const r = spawnSync("vercel", ["--version"], { stdio: "ignore" });
  return r.status === 0;
}

export async function isVercelLoggedIn(): Promise<boolean> {
  const r = spawnSync("vercel", ["whoami"], { stdio: "ignore" });
  return r.status === 0;
}

export async function vercelLogin(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("vercel", ["login"], { stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`vercel login failed: ${code}`))
    );
  });
}

export async function setVercelEnvVars(
  projectDir: string,
  vars: Record<string, string>
): Promise<void> {
  for (const [key, value] of Object.entries(vars)) {
    // Remove any existing value, then add for production + preview
    spawnSync("vercel", ["env", "rm", key, "production", "-y"], {
      cwd: projectDir,
      stdio: "ignore",
    });
    spawnSync("vercel", ["env", "rm", key, "preview", "-y"], {
      cwd: projectDir,
      stdio: "ignore",
    });

    const add = spawnSync("vercel", ["env", "add", key, "production"], {
      cwd: projectDir,
      input: value,
      encoding: "utf-8",
    });
    if (add.status !== 0) {
      throw new Error(
        `Failed to set env var ${key}: ${add.stderr || "unknown error"}`
      );
    }
  }
}

export async function deployToVercel(
  serverDir: string,
  envVars: Record<string, string>
): Promise<string> {
  // Link first (interactive — user picks scope, confirms project name).
  // Using `vercel link` instead of `deploy --yes` so prompts surface clearly.
  const link = spawnSync("vercel", ["link", "--yes"], {
    cwd: serverDir,
    stdio: "inherit",
  });
  if (link.status !== 0) {
    throw new Error(`vercel link failed (exit ${link.status})`);
  }

  // Set env vars before first deploy so the build has them.
  await setVercelEnvVars(serverDir, envVars);

  // Deploy with inherited stdio so the user sees progress and any prompts,
  // but capture stdout separately to parse the deployment URL.
  const deploy = spawnSync("vercel", ["deploy", "--prod"], {
    cwd: serverDir,
    encoding: "utf-8",
    stdio: ["inherit", "pipe", "inherit"],
  });
  if (deploy.status !== 0) {
    throw new Error(`vercel deploy failed (exit ${deploy.status})`);
  }

  // Echo the captured stdout so the user sees the URL too.
  if (deploy.stdout) process.stdout.write(deploy.stdout);

  const urlMatch = deploy.stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
  if (!urlMatch) {
    throw new Error("could not parse deployment URL from vercel output");
  }
  return urlMatch[0];
}
