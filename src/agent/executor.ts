import type { WireCommand } from "../shared/types.js";

/** Result from executing a tool command */
export interface ExecutionResult {
  output: string;
  exitCode: number;
}

/**
 * TODO: Execute a bash command with timeout.
 * Spawns a child process, captures stdout+stderr, enforces timeout.
 * Returns exit code 124 on timeout (matching Unix convention).
 */
export async function executeBash(
  _command: string,
  _workingDirectory?: string,
  _timeoutSeconds?: number
): Promise<ExecutionResult> {
  // TODO: use child_process.spawn with timeout
  // Kill process tree on timeout, return exit code 124
  throw new Error("TODO: implement executeBash");
}

/**
 * TODO: Read a file and return its contents.
 * Validates path exists, handles encoding, respects size limits.
 */
export async function executeReadFile(
  _path: string
): Promise<ExecutionResult> {
  // TODO: use fs.readFile with utf-8 encoding
  throw new Error("TODO: implement executeReadFile");
}

/**
 * TODO: Write content to a file.
 * Creates parent directories if needed.
 */
export async function executeWriteFile(
  _path: string,
  _content: string
): Promise<ExecutionResult> {
  // TODO: use fs.writeFile, create dirs with fs.mkdir recursive
  throw new Error("TODO: implement executeWriteFile");
}

/**
 * TODO: Route a WireCommand to the appropriate executor function.
 * Dispatches based on tool name: run_on_*, read_file, write_file.
 */
export async function executeCommand(
  _command: WireCommand
): Promise<ExecutionResult> {
  // TODO: parse tool name, extract input fields, call appropriate executor
  throw new Error("TODO: implement executeCommand");
}
