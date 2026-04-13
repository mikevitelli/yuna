import type { DeviceConfig } from "./types.js";

/**
 * Device registry CRUD — all other server modules depend on this.
 * Devices are stored in Redis:
 *   yuna:devices          → SET of device names
 *   yuna:device:{name}    → HASH with device metadata
 *   yuna:lastseen:{name}  → STRING with ISO timestamp
 */

// Re-export DeviceConfig for convenience
export type { DeviceConfig };

/** Device with computed online status */
export interface DeviceWithStatus extends DeviceConfig {
  online: boolean;
  lastSeen: string | null;
}

/**
 * TODO: List all registered device names.
 * SMEMBERS yuna:devices
 */
export async function listDeviceNames(): Promise<string[]> {
  // TODO: redis.smembers(KEY_DEVICES)
  throw new Error("TODO: implement listDeviceNames");
}

/**
 * TODO: Get a single device's config by name.
 * HGETALL yuna:device:{name}
 */
export async function getDevice(
  _name: string
): Promise<DeviceConfig | null> {
  // TODO: redis.hgetall(keyDevice(name)), parse capabilities/ssh from JSON
  throw new Error("TODO: implement getDevice");
}

/**
 * TODO: List all devices with their online/offline status.
 * Combines device metadata with lastSeen timestamp.
 * A device is "online" if now - lastSeen < 60s.
 */
export async function listDevicesWithStatus(): Promise<DeviceWithStatus[]> {
  // TODO: get all device names, fetch each device + lastSeen, compute online status
  throw new Error("TODO: implement listDevicesWithStatus");
}

/**
 * TODO: Register a new device.
 * 1. SADD name to yuna:devices
 * 2. HSET device metadata to yuna:device:{name}
 * 3. Create Redis stream consumer group for yuna:stream:{name}
 */
export async function registerDevice(
  _config: DeviceConfig
): Promise<void> {
  // TODO: redis.sadd(KEY_DEVICES, config.name)
  //       redis.hset(keyDevice(config.name), { ...config, capabilities: JSON.stringify(...), ssh: JSON.stringify(...) })
  //       Create consumer group "agent" on stream
  throw new Error("TODO: implement registerDevice");
}

/**
 * TODO: Update a device's metadata.
 * HSET on yuna:device:{name} with changed fields.
 */
export async function updateDevice(
  _name: string,
  _updates: Partial<Omit<DeviceConfig, "name">>
): Promise<void> {
  // TODO: redis.hset(keyDevice(name), updates)
  throw new Error("TODO: implement updateDevice");
}

/**
 * TODO: Remove a device entirely.
 * 1. SREM from yuna:devices
 * 2. DEL yuna:device:{name}
 * 3. DEL yuna:token:{token} (need to find token first)
 * 4. DEL yuna:stream:{name}
 * 5. DEL yuna:lastseen:{name}
 */
export async function removeDevice(_name: string): Promise<void> {
  // TODO: clean up all Redis keys for this device
  throw new Error("TODO: implement removeDevice");
}

/**
 * TODO: Update a device's last-seen timestamp.
 * SET yuna:lastseen:{name} with 86400s TTL.
 */
export async function touchDevice(_name: string): Promise<void> {
  // TODO: redis.set(keyLastSeen(name), new Date().toISOString(), { ex: 86400 })
  throw new Error("TODO: implement touchDevice");
}
