import { Redis } from "@upstash/redis";
import type {
  ConversationMessage,
  OrchestrationTask,
  AuditLogEntry,
} from "./types";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── Key prefixes ────────────────────────────────────────────────────────────

export const KEY_DEVICES = "yuna:devices";
export const keyDevice = (name: string) => `yuna:device:${name}`;
export const keyToken = (token: string) => `yuna:token:${token}`;
export const keyDeviceToken = (name: string) => `yuna:device-token:${name}`;
export const keySetupCode = (code: string) => `yuna:setup-code:${code}`;
export const keyLastSeen = (name: string) => `yuna:lastseen:${name}`;
export const keyStream = (name: string) => `yuna:stream:${name}`;
export const KEY_CONVERSATION = "yuna:conversation:messages";
export const keyOrchestration = (taskId: string) =>
  `yuna:orchestration:${taskId}`;
export const keyPendingConfirm = (msgId: number | string) =>
  `yuna:pending-confirm:${msgId}`;
export const KEY_LOG = "yuna:log";
export const KEY_MASTER = "yuna:master";

export const STREAM_GROUP = "agent";
const MAX_CONVERSATION_BYTES = 800_000;
const MAX_LOG_ENTRIES = 1000;

// ─── Stream helpers ──────────────────────────────────────────────────────────

const initializedStreams = new Set<string>();

export async function ensureConsumerGroup(device: string): Promise<void> {
  const key = keyStream(device);
  if (initializedStreams.has(key)) return;
  try {
    await redis.xgroup(key, {
      type: "CREATE",
      group: STREAM_GROUP,
      id: "0",
      options: { MKSTREAM: true },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("BUSYGROUP")) throw e;
  }
  initializedStreams.add(key);
}

export async function addToStream(
  device: string,
  fields: Record<string, string>
): Promise<string> {
  await ensureConsumerGroup(device);
  return redis.xadd(
    keyStream(device),
    "*",
    fields,
    { trim: { type: "MAXLEN", threshold: 1000, comparison: "~" } }
  );
}

export interface StreamEntry {
  id: string;
  fields: Record<string, string>;
}

function parseStreamEntry(msg: unknown): StreamEntry | null {
  if (!msg || typeof msg !== "object") return null;

  // Object form: { id, fields }
  if ("id" in (msg as Record<string, unknown>)) {
    const obj = msg as Record<string, unknown>;
    return {
      id: String(obj.id),
      fields: (obj.fields as Record<string, string>) || {},
    };
  }

  // Array form: [id, [field, value, ...]] or [id, {fields}]
  if (Array.isArray(msg) && msg.length >= 2) {
    const id = String(msg[0]);
    const raw = msg[1];
    if (Array.isArray(raw)) {
      const fields: Record<string, string> = {};
      for (let i = 0; i < raw.length; i += 2) {
        fields[String(raw[i])] =
          typeof raw[i + 1] === "string"
            ? raw[i + 1]
            : JSON.stringify(raw[i + 1]);
      }
      return { id, fields };
    }
    if (typeof raw === "object" && raw !== null) {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        fields[k] = typeof v === "string" ? v : JSON.stringify(v);
      }
      return { id, fields };
    }
  }

  return null;
}

export async function readFromStream(
  device: string,
  count: number = 10
): Promise<StreamEntry[]> {
  await ensureConsumerGroup(device);
  const results = await redis.xreadgroup(
    STREAM_GROUP,
    device,
    keyStream(device),
    ">",
    { count }
  );

  if (!results || !Array.isArray(results) || results.length === 0) return [];

  const entries: StreamEntry[] = [];
  for (const stream of results) {
    const messages = extractMessages(stream);
    for (const msg of messages) {
      const parsed = parseStreamEntry(msg);
      if (parsed) entries.push(parsed);
    }
  }
  return entries;
}

function extractMessages(stream: unknown): unknown[] {
  if (!stream || typeof stream !== "object") return [];
  if ("messages" in (stream as Record<string, unknown>)) {
    const msgs = (stream as Record<string, unknown>).messages;
    return Array.isArray(msgs) ? msgs : [];
  }
  if (Array.isArray(stream) && stream.length >= 2 && Array.isArray(stream[1])) {
    return stream[1];
  }
  return [];
}

export async function ackStream(
  device: string,
  messageId: string
): Promise<void> {
  await redis.xack(keyStream(device), STREAM_GROUP, messageId);
}

const PENDING_RECLAIM_MS = 60_000;

export async function reclaimPending(
  device: string,
  count: number = 10
): Promise<StreamEntry[]> {
  const raw = await redis.xpending(
    keyStream(device),
    STREAM_GROUP,
    "-",
    "+",
    count
  );
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];

  const staleIds: string[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 3) continue;
    const id = String(entry[0]);
    const idleMs = Number(entry[2]);
    if (idleMs >= PENDING_RECLAIM_MS) staleIds.push(id);
  }
  if (staleIds.length === 0) return [];

  const claimed = await redis.xclaim(
    keyStream(device),
    STREAM_GROUP,
    device,
    PENDING_RECLAIM_MS,
    staleIds
  );

  if (!claimed || !Array.isArray(claimed)) return [];
  const entries: StreamEntry[] = [];
  for (const item of claimed) {
    const parsed = parseStreamEntry(item);
    if (parsed) entries.push(parsed);
  }
  return entries;
}

// ─── Conversation helpers ────────────────────────────────────────────────────

export async function loadConversation(): Promise<ConversationMessage[]> {
  const raw = await redis.get<string>(KEY_CONVERSATION);
  if (!raw) return [];
  try {
    return typeof raw === "string"
      ? JSON.parse(raw)
      : (raw as ConversationMessage[]);
  } catch {
    return [];
  }
}

export async function saveConversation(
  messages: ConversationMessage[]
): Promise<void> {
  let serialized = JSON.stringify(messages);
  while (serialized.length > MAX_CONVERSATION_BYTES && messages.length > 4) {
    messages.splice(2, 2); // drop oldest pair, keep first exchange as anchor
    serialized = JSON.stringify(messages);
  }
  await redis.set(KEY_CONVERSATION, serialized, { ex: 604800 });
}

export async function clearConversation(): Promise<void> {
  await redis.del(KEY_CONVERSATION);
}

// ─── Orchestration helpers ───────────────────────────────────────────────────

export async function saveOrchestrationTask(
  taskId: string,
  task: OrchestrationTask
): Promise<void> {
  await redis.set(keyOrchestration(taskId), JSON.stringify(task), { ex: 300 });
}

export async function loadOrchestrationTask(
  taskId: string
): Promise<OrchestrationTask | null> {
  const raw = await redis.get<string>(keyOrchestration(taskId));
  if (!raw) return null;
  return typeof raw === "string"
    ? JSON.parse(raw)
    : (raw as OrchestrationTask);
}

export async function deleteOrchestrationTask(taskId: string): Promise<void> {
  await redis.del(keyOrchestration(taskId));
}

// ─── Pending confirmation (risky command gate) ───────────────────────────────

export interface PendingConfirm {
  taskId: string;
  toolCallIndex: number;
}

export async function savePendingConfirm(
  msgId: number,
  pending: PendingConfirm
): Promise<void> {
  await redis.set(keyPendingConfirm(msgId), JSON.stringify(pending), {
    ex: 300,
  });
}

export async function loadPendingConfirm(
  msgId: number
): Promise<PendingConfirm | null> {
  const raw = await redis.get<string>(keyPendingConfirm(msgId));
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : (raw as PendingConfirm);
}

export async function deletePendingConfirm(msgId: number): Promise<void> {
  await redis.del(keyPendingConfirm(msgId));
}

// ─── Audit log ───────────────────────────────────────────────────────────────

export async function appendLog(entry: AuditLogEntry): Promise<void> {
  await redis.lpush(KEY_LOG, JSON.stringify(entry));
  await redis.ltrim(KEY_LOG, 0, MAX_LOG_ENTRIES - 1);
}

export async function readLog(count: number = 50): Promise<AuditLogEntry[]> {
  const raw = await redis.lrange(KEY_LOG, 0, count - 1);
  return raw
    .map((r) => {
      try {
        return typeof r === "string" ? JSON.parse(r) : r;
      } catch {
        return null;
      }
    })
    .filter((e): e is AuditLogEntry => e !== null);
}
