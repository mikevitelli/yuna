import type { YunaDeviceConfig } from "../shared/types.js";

/**
 * Device agent — Node.js polling loop.
 *
 * Replaces the bash relay-agent. Polls the server for commands,
 * executes them locally, and posts results back.
 *
 * TODO: Implement the polling loop:
 * 1. Load device config (serverUrl, deviceToken, deviceName)
 * 2. Poll GET /api/relay/poll with Authorization: Bearer {deviceToken}
 * 3. If command received: execute via executor.ts, POST result to /api/relay/respond
 * 4. If no command: wait with exponential backoff (1s → 2s → 4s → max 30s)
 * 5. Reset backoff to 1s after successful command execution
 * 6. Handle SIGINT/SIGTERM for graceful shutdown
 * 7. Log activity to stdout
 */

interface AgentOptions {
  config: YunaDeviceConfig;
  signal?: AbortSignal;
}

/**
 * TODO: Start the device agent polling loop.
 * Runs until the abort signal fires or process exits.
 */
export async function startAgent(_options: AgentOptions): Promise<void> {
  // TODO: implement polling loop with exponential backoff
  // const { config, signal } = options;
  // const baseUrl = config.serverUrl;
  // const headers = { Authorization: `Bearer ${config.deviceToken}` };
  //
  // let backoffMs = 1000;
  // while (!signal?.aborted) {
  //   try {
  //     const poll = await fetch(`${baseUrl}/api/relay/poll`, { headers });
  //     const data = await poll.json();
  //     if (data.command) {
  //       backoffMs = 1000;
  //       const result = await executeCommand(data.command);
  //       await fetch(`${baseUrl}/api/relay/respond`, {
  //         method: 'POST',
  //         headers: { ...headers, 'Content-Type': 'application/json' },
  //         body: JSON.stringify({ device: config.deviceName, taskId: data.command.taskId, ...result, streamId: data.streamId }),
  //       });
  //     } else {
  //       backoffMs = Math.min(backoffMs * 2, 30000);
  //       await sleep(backoffMs);
  //     }
  //   } catch (err) {
  //     // retry with backoff
  //     backoffMs = Math.min(backoffMs * 2, 30000);
  //     await sleep(backoffMs);
  //   }
  // }
  throw new Error("TODO: implement startAgent");
}
