/**
 * Vercel deploy automation helpers.
 * Used by `yuna init` to deploy the server to Vercel.
 */

/** TODO: Check if `vercel` CLI is installed and accessible in PATH */
export async function isVercelInstalled(): Promise<boolean> {
  // TODO: run `which vercel` or `vercel --version`
  throw new Error("TODO: implement isVercelInstalled");
}

/** TODO: Check if user is logged into Vercel CLI */
export async function isVercelLoggedIn(): Promise<boolean> {
  // TODO: run `vercel whoami`
  throw new Error("TODO: implement isVercelLoggedIn");
}

/** TODO: Run `vercel login` interactively */
export async function vercelLogin(): Promise<void> {
  // TODO: spawn `vercel login` with inherited stdio
  throw new Error("TODO: implement vercelLogin");
}

/**
 * TODO: Deploy server/ directory to Vercel.
 * 1. Run `vercel deploy --prod` in server/ directory
 * 2. Set all required env vars via `vercel env add`
 * 3. Return the deployment URL
 */
export async function deployToVercel(
  _serverDir: string,
  _envVars: Record<string, string>
): Promise<string> {
  // TODO: implement Vercel deployment
  throw new Error("TODO: implement deployToVercel");
}

/**
 * TODO: Set environment variables on the Vercel project.
 * Uses `vercel env add` for each key-value pair.
 */
export async function setVercelEnvVars(
  _projectDir: string,
  _vars: Record<string, string>
): Promise<void> {
  throw new Error("TODO: implement setVercelEnvVars");
}
