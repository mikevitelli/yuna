import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import {
  loadConversation,
  saveConversation,
  addToStream,
  saveOrchestrationTask,
  loadOrchestrationTask,
  deleteOrchestrationTask,
  savePendingConfirm,
  appendLog,
} from "./redis";
import { listDeviceNames, isOnline } from "./devices";
import { buildDeviceTools, toolToDevice } from "./tools";
import { buildSystemPrompt } from "./system-prompt";
import { sendMessage, sendTypingAction, mdToTgHtml, escapeHtml } from "./telegram";
import { classifyToolCall } from "./risk";
import type {
  OrchestrationTask,
  ToolCall,
  ConversationMessage,
} from "./types";

const MAX_STEPS = 10;
const MAX_OFFLINE_RETRIES = 3;
const DEFAULT_MODEL =
  process.env.YUNA_DEFAULT_MODEL || "claude-haiku-4-5-20251001";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── Model override parsing (@opus, @sonnet, @haiku) ─────────────────────────

function parseModelOverride(text: string): {
  model: string;
  cleanText: string;
} {
  const match = text.match(/^@(opus|sonnet|haiku)\s+/i);
  if (!match) return { model: DEFAULT_MODEL, cleanText: text };
  const m = match[1].toLowerCase();
  const models: Record<string, string> = {
    opus: "claude-opus-4-6",
    sonnet: "claude-sonnet-4-6",
    haiku: DEFAULT_MODEL,
  };
  return {
    model: models[m] || DEFAULT_MODEL,
    cleanText: text.slice(match[0].length),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function handleUserMessage(
  chatId: number,
  messageId: number,
  text: string
): Promise<void> {
  const { model, cleanText } = parseModelOverride(text);

  const history = await loadConversation();
  history.push({ role: "user", content: cleanText });

  let response: Anthropic.Message;
  try {
    response = await callClaude(model, history);
  } catch (e) {
    await handleClaudeError(chatId, e);
    return;
  }

  history.push({ role: "assistant", content: response.content });
  await saveConversation(history);

  if (response.stop_reason === "tool_use") {
    await dispatchToolCalls(response, chatId, messageId, model);
    return;
  }

  await sendFinalText(chatId, response);
}

export async function handleToolResult(
  taskId: string,
  output: string,
  exitCode?: number
): Promise<void> {
  const task = await loadOrchestrationTask(taskId);
  if (!task) return;

  task.toolCalls[task.currentIndex].result = output;
  task.toolCalls[task.currentIndex].exitCode = exitCode;
  task.currentIndex++;

  // More tool calls in this batch? Dispatch the next one.
  if (task.currentIndex < task.toolCalls.length) {
    await saveOrchestrationTask(taskId, task);
    const nextCall = task.toolCalls[task.currentIndex];
    await dispatchSingleCommand(taskId, nextCall, task.chatId, task.messageId);
    return;
  }

  // All tool calls complete — feed batch of tool_results to Claude
  const toolResults = task.toolCalls.map((tc) => ({
    type: "tool_result" as const,
    tool_use_id: tc.id,
    content: wrapToolOutput(tc.device, tc.name, tc.result, tc.exitCode),
  }));

  const history = await loadConversation();
  history.push({ role: "user", content: toolResults });

  let response: Anthropic.Message;
  try {
    response = await callClaude(task.model, history);
  } catch (e) {
    await deleteOrchestrationTask(taskId);
    await handleClaudeError(task.chatId, e);
    return;
  }

  history.push({ role: "assistant", content: response.content });
  await saveConversation(history);

  // Another round of tool calls?
  if (response.stop_reason === "tool_use") {
    task.stepCount++;
    if (task.stepCount >= task.maxSteps) {
      await deleteOrchestrationTask(taskId);
      await sendMessage(task.chatId, "(reached max steps, stopping)");
      return;
    }
    await deleteOrchestrationTask(taskId);
    await dispatchToolCalls(response, task.chatId, task.messageId, task.model);
    return;
  }

  // Final text response
  await deleteOrchestrationTask(taskId);
  await sendFinalText(task.chatId, response);
}

export async function clearConversationHistory(): Promise<void> {
  const { clearConversation } = await import("./redis");
  await clearConversation();
}

// ─── Internals ───────────────────────────────────────────────────────────────

async function callClaude(
  model: string,
  history: ConversationMessage[]
): Promise<Anthropic.Message> {
  const [systemPrompt, tools] = await Promise.all([
    buildSystemPrompt(),
    buildDeviceTools(),
  ]);

  return client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    tools,
    messages: history as Anthropic.MessageParam[],
  });
}

async function dispatchToolCalls(
  response: Anthropic.Message,
  chatId: number,
  messageId: number,
  model: string,
  depth: number = 0
): Promise<void> {
  if (depth >= MAX_OFFLINE_RETRIES) {
    await sendMessage(chatId, "All devices offline. Giving up.");
    return;
  }

  const toolUseBlocks = response.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );

  if (toolUseBlocks.length === 0) {
    await sendMessage(chatId, "(no tool_use blocks found)");
    return;
  }

  const knownDevices = await listDeviceNames();
  const toolCalls: ToolCall[] = [];

  for (const tu of toolUseBlocks) {
    const input = tu.input as Record<string, unknown>;
    const device = toolToDevice(tu.name, input, knownDevices);

    if (!device) {
      toolCalls.push({
        id: tu.id,
        name: tu.name,
        input,
        device: "unknown",
        result: `Error: Unknown device for tool "${tu.name}". Available devices: ${knownDevices.join(", ") || "(none)"}`,
        exitCode: 1,
      });
      continue;
    }

    const online = await isOnline(device);
    if (!online) {
      toolCalls.push({
        id: tu.id,
        name: tu.name,
        input,
        device,
        result: `Error: Device "${device}" is offline.`,
        exitCode: 1,
      });
    } else {
      toolCalls.push({ id: tu.id, name: tu.name, input, device });
    }
  }

  // All pre-resolved? Feed back to Claude without dispatching.
  const allResolved = toolCalls.every((tc) => tc.result !== undefined);
  if (allResolved) {
    const toolResults = toolCalls.map((tc) => ({
      type: "tool_result" as const,
      tool_use_id: tc.id,
      content: wrapToolOutput(tc.device, tc.name, tc.result, tc.exitCode),
      is_error: true,
    }));

    const history = await loadConversation();
    history.push({ role: "user", content: toolResults });

    let retryResponse: Anthropic.Message;
    try {
      retryResponse = await callClaude(model, history);
    } catch (e) {
      await handleClaudeError(chatId, e);
      return;
    }

    history.push({ role: "assistant", content: retryResponse.content });
    await saveConversation(history);

    if (retryResponse.stop_reason === "tool_use") {
      await dispatchToolCalls(retryResponse, chatId, messageId, model, depth + 1);
      return;
    }

    await sendFinalText(chatId, retryResponse);
    return;
  }

  // Dispatch the first unresolved tool call
  const firstPending = toolCalls.findIndex((tc) => tc.result === undefined);
  const taskId = randomUUID();
  const task: OrchestrationTask = {
    taskId,
    chatId,
    messageId,
    status: "in-progress",
    toolCalls,
    currentIndex: firstPending,
    stepCount: 0,
    maxSteps: MAX_STEPS,
    model,
    createdAt: new Date().toISOString(),
  };
  await saveOrchestrationTask(taskId, task);
  await dispatchSingleCommand(
    taskId,
    toolCalls[firstPending],
    chatId,
    messageId
  );
  await sendTypingAction(chatId);
}

async function dispatchSingleCommand(
  taskId: string,
  toolCall: ToolCall,
  chatId: number,
  messageId: number
): Promise<void> {
  // Risk gate: if the command is destructive, hold it for user confirmation
  // instead of dispatching. Defends against prompt-injection-driven misuse.
  const risk = classifyToolCall(toolCall.name, toolCall.input);
  if (risk.risky) {
    await requestConfirmation(taskId, toolCall, risk.reason || "risky", risk.summary, chatId);
    return;
  }

  await dispatchSingleCommandRaw(taskId, toolCall, chatId, messageId);
}

async function dispatchSingleCommandRaw(
  taskId: string,
  toolCall: ToolCall,
  chatId: number,
  messageId: number
): Promise<void> {
  const payload = JSON.stringify({
    type: "command",
    taskId,
    tool: toolCall.name,
    input: toolCall.input,
  });

  await addToStream(toolCall.device, {
    type: "command",
    taskId,
    tool: toolCall.name,
    input: JSON.stringify(toolCall.input),
    chatId: String(chatId),
    messageId: String(messageId),
    payload,
    timestamp: new Date().toISOString(),
  });

  await appendLog({
    ts: new Date().toISOString(),
    type: "command",
    device: toolCall.device,
    tool: toolCall.name,
    command:
      typeof toolCall.input.command === "string"
        ? toolCall.input.command
        : undefined,
    taskId,
  });
}

// ─── Confirmation gate for risky commands ────────────────────────────────────

async function requestConfirmation(
  taskId: string,
  toolCall: ToolCall,
  reason: string,
  summary: string,
  chatId: number
): Promise<void> {
  const device = toolCall.device;
  const confirmText =
    `⚠️ <b>Confirm risky command</b>\n` +
    `Device: <b>${escapeHtml(device)}</b>\n` +
    `Reason: ${escapeHtml(reason)}\n\n` +
    `<pre>${escapeHtml(summary)}</pre>\n\n` +
    `React 👍 to run, ❌ to cancel. (expires in 5 min)`;

  const confirmMsgId = await sendMessage(chatId, confirmText);
  if (!confirmMsgId) {
    // Couldn't send confirmation message — fail closed: treat as declined.
    await handleConfirmationDecline(taskId);
    return;
  }

  // Load existing task to find the toolCall index (currentIndex points at it).
  const task = await loadOrchestrationTask(taskId);
  const toolCallIndex = task ? task.currentIndex : 0;

  await savePendingConfirm(confirmMsgId, { taskId, toolCallIndex });

  await appendLog({
    ts: new Date().toISOString(),
    type: "command",
    device,
    tool: toolCall.name,
    command: `[confirmation requested] ${summary}`,
    taskId,
  });
}

export async function handleConfirmationApprove(taskId: string): Promise<void> {
  const task = await loadOrchestrationTask(taskId);
  if (!task) return;
  const toolCall = task.toolCalls[task.currentIndex];
  if (!toolCall) return;
  await sendTypingAction(task.chatId);
  await dispatchSingleCommandRaw(taskId, toolCall, task.chatId, task.messageId);
}

export async function handleConfirmationDecline(taskId: string): Promise<void> {
  const task = await loadOrchestrationTask(taskId);
  if (!task) return;
  // Synthesize a tool_result saying the user declined, then continue the loop.
  await handleToolResult(taskId, "User declined to run this command.", 1);
}

async function sendFinalText(
  chatId: number,
  response: Anthropic.Message
): Promise<void> {
  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  const text = textBlock?.text || "(no response)";
  const formatted = mdToTgHtml(text);
  await sendMessage(chatId, formatted);
}

// Wrap tool output in untrusted-data delimiters. The system prompt instructs
// the model to treat everything inside <tool_output> as data, never as
// instructions. This is a defense against prompt injection from command
// stdout, file contents, or device logs.
function wrapToolOutput(
  device: string,
  tool: string,
  result: string | undefined,
  exitCode: number | undefined
): string {
  const body = result || "(no output)";
  const exitAttr = exitCode !== undefined ? ` exit="${exitCode}"` : "";
  return `<tool_output device="${device}" tool="${tool}"${exitAttr}>\n${body}\n</tool_output>`;
}

async function handleClaudeError(chatId: number, error: unknown): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error);
  console.error("[orchestrator] Claude API error:", msg);
  await appendLog({
    ts: new Date().toISOString(),
    type: "error",
    device: "server",
    tool: "claude-api",
    taskId: "",
    command: msg,
  });
  await sendMessage(chatId, `Error: ${msg}`);
}
