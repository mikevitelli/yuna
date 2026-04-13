import {
  redis,
  KEY_DEVICES,
  keyDevice,
  keyLastSeen,
  keyStream,
  ensureConsumerGroup,
} from "./redis";
import { revokeDeviceToken } from "./auth";
import type { DeviceConfig } from "./types";

export type { DeviceConfig };

export interface DeviceWithStatus extends DeviceConfig {
  online: boolean;
  lastSeen: string | null;
}

const ONLINE_THRESHOLD_MS = 60_000;

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function listDeviceNames(): Promise<string[]> {
  return redis.smembers(KEY_DEVICES);
}

export async function getDevice(name: string): Promise<DeviceConfig | null> {
  const raw = await redis.hgetall<Record<string, string>>(keyDevice(name));
  if (!raw || Object.keys(raw).length === 0) return null;

  return {
    name,
    os: String(raw.os || ""),
    description: String(raw.description || ""),
    capabilities: parseJsonField(raw.capabilities, []),
    ssh: parseJsonField(raw.ssh, {}),
    registeredAt: String(raw.registeredAt || ""),
  };
}

export async function getLastSeen(name: string): Promise<string | null> {
  return redis.get<string>(keyLastSeen(name));
}

export async function isOnline(name: string): Promise<boolean> {
  const lastSeen = await getLastSeen(name);
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS;
}

export async function listDevicesWithStatus(): Promise<DeviceWithStatus[]> {
  const names = await listDeviceNames();
  if (names.length === 0) return [];

  const results = await Promise.all(
    names.map(async (name) => {
      const [device, lastSeen] = await Promise.all([
        getDevice(name),
        getLastSeen(name),
      ]);
      if (!device) return null;
      const online =
        !!lastSeen && Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS;
      return { ...device, lastSeen, online };
    })
  );

  return results.filter((d): d is DeviceWithStatus => d !== null);
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export async function registerDevice(config: DeviceConfig): Promise<void> {
  await redis.sadd(KEY_DEVICES, config.name);
  await redis.hset(keyDevice(config.name), {
    os: config.os,
    description: config.description,
    capabilities: JSON.stringify(config.capabilities),
    ssh: JSON.stringify(config.ssh),
    registeredAt: config.registeredAt,
  });
  await ensureConsumerGroup(config.name);
  await touchDevice(config.name);
}

export async function updateDevice(
  name: string,
  updates: Partial<Omit<DeviceConfig, "name">>
): Promise<void> {
  const serialized: Record<string, string> = {};
  if (updates.os !== undefined) serialized.os = updates.os;
  if (updates.description !== undefined)
    serialized.description = updates.description;
  if (updates.capabilities !== undefined)
    serialized.capabilities = JSON.stringify(updates.capabilities);
  if (updates.ssh !== undefined)
    serialized.ssh = JSON.stringify(updates.ssh);
  if (updates.registeredAt !== undefined)
    serialized.registeredAt = updates.registeredAt;

  if (Object.keys(serialized).length === 0) return;
  await redis.hset(keyDevice(name), serialized);
}

export async function removeDevice(name: string): Promise<void> {
  await revokeDeviceToken(name);
  await redis.srem(KEY_DEVICES, name);
  await redis.del(keyDevice(name));
  await redis.del(keyStream(name));
  await redis.del(keyLastSeen(name));
}

export async function touchDevice(name: string): Promise<void> {
  await redis.set(keyLastSeen(name), new Date().toISOString(), { ex: 86400 });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw !== "string") return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
