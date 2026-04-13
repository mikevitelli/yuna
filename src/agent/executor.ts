import { spawn } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { homedir } from "os";
import type { WireCommand } from "../shared/types.js";

export interface ExecutionResult {
  output: string;
  exitCode: number;
}

const MAX_OUTPUT_CHARS = 8000;

// ─── Bash execution ──────────────────────────────────────────────────────────

export async function executeBash(
  command: string,
  workingDirectory?: string,
  timeoutSeconds: number = 30
): Promise<ExecutionResult> {
  const cwd = workingDirectory || homedir();

  return new Promise((resolve) => {
    let output = "";
    let exitCode = 0;
    let timedOut = false;

    const child = spawn("bash", ["-c", command], { cwd });

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutSeconds * 1000);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        exitCode = 124;
        output += `\n[killed: timeout after ${timeoutSeconds}s]`;
      } else {
        exitCode = code ?? 1;
      }
      resolve({ output: truncate(output), exitCode });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ output: `[spawn error] ${err.message}`, exitCode: 1 });
    });
  });
}

// ─── File I/O ────────────────────────────────────────────────────────────────

export async function executeReadFile(
  path: string,
  maxLines?: number
): Promise<ExecutionResult> {
  try {
    const content = readFileSync(path, "utf-8");
    if (maxLines && maxLines > 0) {
      const lines = content.split("\n").slice(0, maxLines);
      return { output: truncate(lines.join("\n")), exitCode: 0 };
    }
    return { output: truncate(content), exitCode: 0 };
  } catch (e) {
    return {
      output: `read_file error: ${(e as Error).message}`,
      exitCode: 1,
    };
  }
}

export async function executeWriteFile(
  path: string,
  content: string
): Promise<ExecutionResult> {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    return { output: `Written: ${path}`, exitCode: 0 };
  } catch (e) {
    return {
      output: `write_file error: ${(e as Error).message}`,
      exitCode: 1,
    };
  }
}

// ─── Mesh transfer ───────────────────────────────────────────────────────────

export async function executeTransferFile(
  fromPath: string,
  toPath: string,
  sshAlias: string
): Promise<ExecutionResult> {
  return executeBash(`scp "${fromPath}" "${sshAlias}:${toPath}"`);
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

export async function executeCommand(
  command: WireCommand
): Promise<ExecutionResult> {
  const { tool, input } = command;

  if (tool.startsWith("run_on_")) {
    const cmd = String(input.command || "");
    const cwd =
      typeof input.working_directory === "string"
        ? input.working_directory
        : undefined;
    const timeout =
      typeof input.timeout_seconds === "number" ? input.timeout_seconds : 30;
    return executeBash(cmd, cwd, timeout);
  }

  if (tool === "read_file") {
    const path = String(input.path || "");
    const maxLines =
      typeof input.max_lines === "number" ? input.max_lines : undefined;
    return executeReadFile(path, maxLines);
  }

  if (tool === "write_file") {
    const path = String(input.path || "");
    const content = String(input.content || "");
    return executeWriteFile(path, content);
  }

  if (tool === "transfer_file") {
    const fromPath = String(input.from_path || "");
    const toPath = String(input.to_path || "");
    const toDevice = String(input.to_device || "");
    // SSH alias must be configured in the device's ssh map
    return executeTransferFile(fromPath, toPath, toDevice);
  }

  return {
    output: `Unknown tool: ${tool}`,
    exitCode: 1,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  const head = text.slice(0, MAX_OUTPUT_CHARS / 2);
  const tail = text.slice(-MAX_OUTPUT_CHARS / 2);
  return `${head}\n\n... (truncated ${text.length} chars) ...\n\n${tail}`;
}
