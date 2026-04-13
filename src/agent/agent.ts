import type { YunaDeviceConfig, WireCommand } from "../shared/types.js";
import { executeCommand } from "./executor.js";

interface AgentOptions {
  config: YunaDeviceConfig;
  signal?: AbortSignal;
}

interface PolledMessage {
  streamId: string;
  taskId: string;
  tool: string;
  input: Record<string, unknown>;
  chatId?: number;
  messageId?: number;
}

function log(...args: unknown[]): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}]`, ...args);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

export async function startAgent({ config, signal }: AgentOptions): Promise<void> {
  const { serverUrl, deviceToken, deviceName } = config;
  const authHeaders = {
    Authorization: `Bearer ${deviceToken}`,
    "Content-Type": "application/json",
  };

  log(`Yuna agent starting as "${deviceName}"`);
  log(`Server: ${serverUrl}`);
  log("Listening for commands...");

  let backoffMs = 1000;

  while (!signal?.aborted) {
    try {
      const pollUrl = `${serverUrl}/api/relay/poll`;
      const res = await fetch(pollUrl, {
        headers: authHeaders,
        signal,
      });

      if (!res.ok) {
        log(`Poll failed: HTTP ${res.status}, backing off`);
        await sleep(backoffMs, signal);
        backoffMs = Math.min(backoffMs * 2, 30_000);
        continue;
      }

      const data = (await res.json()) as { messages: PolledMessage[] };
      const messages = data.messages || [];

      if (messages.length === 0) {
        // Long-poll returned empty after ~25s, loop immediately
        backoffMs = 1000;
        continue;
      }

      backoffMs = 1000;

      for (const msg of messages) {
        const wireCommand: WireCommand = {
          type: "command",
          taskId: msg.taskId,
          tool: msg.tool,
          input: msg.input || {},
        };

        const cmdDescription =
          typeof wireCommand.input.command === "string"
            ? wireCommand.input.command
            : typeof wireCommand.input.path === "string"
              ? wireCommand.input.path
              : "?";
        log(`← [${msg.tool}] ${cmdDescription}`);

        const result = await executeCommand(wireCommand);
        log(`→ ${result.output.length} chars (exit ${result.exitCode})`);

        const respondRes = await fetch(`${serverUrl}/api/relay/respond`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            taskId: msg.taskId,
            output: result.output,
            exitCode: result.exitCode,
            streamId: msg.streamId,
          }),
        });

        if (!respondRes.ok) {
          log(`Failed to post result: HTTP ${respondRes.status}`);
        }
      }
    } catch (err) {
      if (signal?.aborted) return;
      log(`Error: ${(err as Error).message}, backing off`);
      await sleep(backoffMs, signal);
      backoffMs = Math.min(backoffMs * 2, 30_000);
    }
  }

  log("Agent stopped");
}
