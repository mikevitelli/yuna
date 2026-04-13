// ─── Device Configuration ────────────────────────────────────────────────────

export interface DeviceConfig {
  name: string;
  os: string;
  description: string;
  capabilities: string[];
  ssh: Record<string, string>; // { "other-device": "ssh-alias" }
  registeredAt: string; // ISO timestamp
}

// ─── Wire Protocol (Server ↔ Device) ────────────────────────────────────────

export interface WireCommand {
  type: "command";
  taskId: string;
  tool: string; // "run_on_{deviceName}" | "read_file" | "write_file"
  input: Record<string, unknown>;
}

export interface DeviceResponse {
  device: string;
  taskId: string;
  output: string;
  exitCode: number;
  streamId: string; // Redis stream message ID for XACK
}

// ─── Conversation ────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string | unknown[]; // string for user, content blocks for assistant
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
  createdAt: string; // ISO timestamp
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  device: string;
  result?: string;
  exitCode?: number;
}

// ─── Relay / Messaging ──────────────────────────────────────────────────────

export interface RelayMessage {
  id: string;
  from: string; // device name
  chatId: number;
  messageId: number;
  text: string;
  target: string; // device name or "server"
  timestamp: string; // ISO timestamp
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface SetupCode {
  code: string;
  createdAt: string; // ISO timestamp
  // Stored in Redis with 10min TTL, single-use
}

export interface DeviceToken {
  token: string;
  device: string;
  registeredAt: string; // ISO timestamp
}

// ─── CLI Config (stored locally) ─────────────────────────────────────────────

export interface YunaConfig {
  botName: string;
  ownerName: string;
  serverUrl: string;
  masterSecretHash?: string; // only on admin machine
}

export interface YunaDeviceConfig {
  serverUrl: string;
  deviceToken: string;
  deviceName: string;
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  ts: string; // ISO timestamp
  type: "command" | "response" | "error";
  device: string;
  tool: string;
  command?: string;
  exitCode?: number;
  outputLength?: number;
  taskId: string;
  durationMs?: number;
}
