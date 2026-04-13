/**
 * Shared types for the Yuna server.
 * These mirror the types in src/shared/types.ts from the CLI package.
 * Duplicated here because the server is a separate Next.js project
 * and can't import from the parent package at runtime.
 */

// ─── Device Configuration ────────────────────────────────────────────────────

export interface DeviceConfig {
  name: string;
  os: string;
  description: string;
  capabilities: string[];
  ssh: Record<string, string>;
  registeredAt: string;
}

// ─── Wire Protocol ───────────────────────────────────────────────────────────

export interface WireCommand {
  type: "command";
  taskId: string;
  tool: string;
  input: Record<string, unknown>;
}

export interface DeviceResponse {
  device: string;
  taskId: string;
  output: string;
  exitCode: number;
  streamId: string;
}

// ─── Conversation ────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string | unknown[];
}

// ─── Orchestration ───────────────────────────────────────────────────────────

export interface OrchestrationTask {
  taskId: string;
  chatId: number;
  messageId: number;
  status: "pending" | "in-progress" | "completed" | "failed" | "expired";
  toolCalls: ToolCall[];
  currentIndex: number;
  stepCount: number;
  maxSteps: number;
  model: string;
  createdAt: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  device: string;
  result?: string;
  exitCode?: number;
}

// ─── Relay ───────────────────────────────────────────────────────────────────

export interface RelayMessage {
  id: string;
  from: string;
  chatId: number;
  messageId: number;
  text: string;
  target: string;
  timestamp: string;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface SetupCode {
  code: string;
  createdAt: string;
}

export interface DeviceToken {
  token: string;
  device: string;
  registeredAt: string;
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  ts: string;
  type: "command" | "response" | "error";
  device: string;
  tool: string;
  command?: string;
  exitCode?: number;
  outputLength?: number;
  taskId: string;
  durationMs?: number;
}
