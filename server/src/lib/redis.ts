import { Redis } from "@upstash/redis";

// ─── Redis Client ────────────────────────────────────────────────────────────

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── Key Prefixes ────────────────────────────────────────────────────────────

/** SET of device names */
export const KEY_DEVICES = "yuna:devices";

/** HASH { os, description, capabilities, ssh, registeredAt } */
export const keyDevice = (name: string) => `yuna:device:${name}`;

/** STRING { device, registeredAt } — per-device auth token */
export const keyToken = (token: string) => `yuna:token:${token}`;

/** STRING { createdAt } — one-time setup code, 10min TTL */
export const keySetupCode = (code: string) => `yuna:setup-code:${code}`;

/** STRING (ISO timestamp) — last seen, 86400s TTL */
export const keyLastSeen = (name: string) => `yuna:lastseen:${name}`;

/** STREAM — per-device command queue, consumer group: "agent" */
export const keyStream = (name: string) => `yuna:stream:${name}`;

/** STRING — shared conversation JSON */
export const KEY_CONVERSATION = "yuna:conversation:messages";

/** STRING — in-flight orchestration task, 5min TTL */
export const keyOrchestration = (taskId: string) => `yuna:orchestration:${taskId}`;

/** LIST — audit log, capped at 1000 entries */
export const KEY_LOG = "yuna:log";

/** STRING — hashed master secret */
export const KEY_MASTER = "yuna:master";

// ─── Stream Helpers ──────────────────────────────────────────────────────────

/** Consumer group name for device agents */
export const STREAM_GROUP = "agent";

/**
 * TODO: Add a command to a device's stream.
 * XADD to yuna:stream:{deviceName} with the wire command fields.
 */
export async function addToStream(
  _deviceName: string,
  _fields: Record<string, string>
): Promise<string> {
  // TODO: redis.xadd(keyStream(deviceName), '*', fields)
  throw new Error("TODO: implement addToStream");
}

/**
 * TODO: Read pending commands from a device's stream.
 * XREADGROUP with consumer group "agent" and consumer = deviceName.
 * Creates the consumer group if it doesn't exist.
 */
export async function readFromStream(
  _deviceName: string,
  _count?: number
): Promise<Array<{ id: string; fields: Record<string, string> }>> {
  // TODO: redis.xreadgroup(STREAM_GROUP, deviceName, keyStream(deviceName), '>', { count })
  throw new Error("TODO: implement readFromStream");
}

/**
 * TODO: Acknowledge a processed stream message.
 * XACK on the device's stream.
 */
export async function ackStream(
  _deviceName: string,
  _messageId: string
): Promise<void> {
  // TODO: redis.xack(keyStream(deviceName), STREAM_GROUP, messageId)
  throw new Error("TODO: implement ackStream");
}

// ─── Conversation Helpers ────────────────────────────────────────────────────

/**
 * TODO: Load conversation messages from Redis.
 * GET yuna:conversation:messages, parse JSON array.
 */
export async function loadConversation(): Promise<unknown[]> {
  // TODO: redis.get(KEY_CONVERSATION) and JSON.parse
  throw new Error("TODO: implement loadConversation");
}

/**
 * TODO: Save conversation messages to Redis.
 * SET yuna:conversation:messages with JSON.stringify.
 */
export async function saveConversation(_messages: unknown[]): Promise<void> {
  // TODO: redis.set(KEY_CONVERSATION, JSON.stringify(messages))
  throw new Error("TODO: implement saveConversation");
}

/**
 * TODO: Clear conversation history.
 * DEL yuna:conversation:messages.
 */
export async function clearConversation(): Promise<void> {
  // TODO: redis.del(KEY_CONVERSATION)
  throw new Error("TODO: implement clearConversation");
}

// ─── Orchestration Helpers ───────────────────────────────────────────────────

/**
 * TODO: Store an orchestration task with 5min TTL.
 */
export async function saveOrchestrationTask(
  _taskId: string,
  _task: unknown
): Promise<void> {
  // TODO: redis.set(keyOrchestration(taskId), JSON.stringify(task), { ex: 300 })
  throw new Error("TODO: implement saveOrchestrationTask");
}

/**
 * TODO: Load an orchestration task by ID.
 */
export async function loadOrchestrationTask(
  _taskId: string
): Promise<unknown | null> {
  // TODO: redis.get(keyOrchestration(taskId)) and JSON.parse
  throw new Error("TODO: implement loadOrchestrationTask");
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

/**
 * TODO: Append an entry to the audit log.
 * LPUSH + LTRIM to cap at 1000 entries.
 */
export async function appendLog(_entry: unknown): Promise<void> {
  // TODO: redis.lpush(KEY_LOG, JSON.stringify(entry))
  //       redis.ltrim(KEY_LOG, 0, 999)
  throw new Error("TODO: implement appendLog");
}

/**
 * TODO: Read recent audit log entries.
 */
export async function readLog(_count?: number): Promise<unknown[]> {
  // TODO: redis.lrange(KEY_LOG, 0, count - 1)
  throw new Error("TODO: implement readLog");
}
