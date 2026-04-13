/**
 * Orchestrator — the brain of Yuna.
 *
 * Receives a user message from Telegram, calls Claude with tool_use,
 * dispatches tool calls to devices via Redis streams, waits for results,
 * and sends the final response back to Telegram.
 *
 * Runs as an async agentic loop: Claude may call multiple tools in sequence.
 */

import type { OrchestrationTask, ToolCall } from "./types.js";

export type { OrchestrationTask, ToolCall };

/**
 * TODO: Handle an incoming user message.
 *
 * Agentic loop:
 * 1. Load conversation history from Redis
 * 2. Append user message
 * 3. Build system prompt (dynamic, from device registry)
 * 4. Build tools (dynamic, from device registry)
 * 5. Call Claude API with messages + tools
 * 6. If response contains tool_use blocks:
 *    a. For each tool call: dispatch to device via Redis stream
 *    b. Create orchestration task with 5min TTL
 *    c. Wait for device response (polled by respond endpoint)
 *    d. Feed tool_result back to Claude
 *    e. Repeat from step 5 (up to maxSteps)
 * 7. If response is text: send to Telegram, save conversation
 * 8. Log all activity to audit log
 *
 * Error handling:
 * - Device offline: return error tool_result immediately
 * - Command timeout: return timeout error
 * - Claude API error: send error to Telegram, don't corrupt conversation
 * - Max steps exceeded: send partial result to Telegram
 */
export async function handleMessage(
  _chatId: number,
  _messageId: number,
  _text: string
): Promise<void> {
  // TODO: implement agentic orchestration loop
  throw new Error("TODO: implement handleMessage");
}

/**
 * TODO: Resume an orchestration task when a device responds.
 *
 * Called by the /api/relay/respond endpoint when a device posts a result.
 * 1. Load the orchestration task
 * 2. Attach the tool result
 * 3. Continue the agentic loop from where it left off
 */
export async function resumeTask(
  _taskId: string,
  _result: string,
  _exitCode: number
): Promise<void> {
  // TODO: load task, update tool call result, continue loop
  throw new Error("TODO: implement resumeTask");
}
