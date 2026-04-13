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
  // Link/deploy (first deploy will prompt for project name)
  const initial = spawnSync(
    "vercel",
    ["deploy", "--prod", "--yes"],
    { cwd: serverDir, encoding: "utf-8" }
  );
  if (initial.status !== 0) {
    throw new Error(`vercel deploy failed: ${initial.stderr}`);
  }

  // Set env vars, then redeploy to apply them
  await setVercelEnvVars(serverDir, envVars);

  const redeploy = spawnSync("vercel", ["deploy", "--prod", "--yes"], {
    cwd: serverDir,
    encoding: "utf-8",
  });
  if (redeploy.status !== 0) {
    throw new Error(`vercel redeploy failed: ${redeploy.stderr}`);
  }

  // Extract URL from output (Vercel prints "https://..." lines)
  const urlMatch = redeploy.stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
  if (!urlMatch) {
    throw new Error("could not parse deployment URL from vercel output");
  }
  return urlMatch[0];
}
