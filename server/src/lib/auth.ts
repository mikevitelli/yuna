import { NextRequest } from "next/server";

/**
 * Per-device token authentication.
 *
 * Each device has a unique token stored at yuna:token:{token} in Redis.
 * The token maps to a device identity (name + registeredAt).
 *
 * Master secret validation uses yuna:master (SHA-256 hash).
 */

/** Result of validating a device token */
export interface AuthResult {
  device: string;
  registeredAt: string;
}

/**
 * TODO: Validate a device token from the Authorization header.
 * 1. Extract Bearer token from Authorization header
 * 2. Look up yuna:token:{token} in Redis
 * 3. Return device identity or null if invalid
 */
export async function validateDeviceToken(
  _request: NextRequest
): Promise<AuthResult | null> {
  // TODO: const authHeader = request.headers.get('authorization');
  //       const token = authHeader?.replace('Bearer ', '');
  //       redis.get(keyToken(token)) → parse and return
  throw new Error("TODO: implement validateDeviceToken");
}

/**
 * TODO: Validate the master secret.
 * Used for admin operations (create-code, revoke-device, telegram setup).
 * Compares SHA-256 hash of provided secret against yuna:master in Redis.
 */
export async function validateMasterSecret(
  _secret: string
): Promise<boolean> {
  // TODO: hash the secret, compare against redis.get(KEY_MASTER)
  throw new Error("TODO: implement validateMasterSecret");
}

/**
 * TODO: Generate and store a per-device token.
 * Creates a UUID token, stores at yuna:token:{token} with device identity.
 * Returns the plaintext token (sent to device once, never stored on server).
 */
export async function issueDeviceToken(
  _deviceName: string
): Promise<string> {
  // TODO: const token = crypto.randomUUID();
  //       redis.set(keyToken(token), JSON.stringify({ device: deviceName, registeredAt: new Date().toISOString() }))
  //       return token
  throw new Error("TODO: implement issueDeviceToken");
}

/**
 * TODO: Revoke a device's token.
 * Finds and deletes the token entry from Redis.
 */
export async function revokeDeviceToken(
  _deviceName: string
): Promise<void> {
  // TODO: scan for token matching this device, delete yuna:token:{token}
  throw new Error("TODO: implement revokeDeviceToken");
}

/**
 * TODO: Validate and consume a one-time setup code.
 * 1. Look up yuna:setup-code:{code} in Redis
 * 2. If found and not expired: delete it (single-use) and return true
 * 3. If not found or expired: return false
 */
export async function validateSetupCode(
  _code: string
): Promise<boolean> {
  // TODO: redis.get(keySetupCode(code)), if exists: redis.del(...), return true
  throw new Error("TODO: implement validateSetupCode");
}

/**
 * TODO: Create a one-time setup code with 10min TTL.
 * Stores at yuna:setup-code:{code} in Redis.
 */
export async function createSetupCode(
  _code: string
): Promise<void> {
  // TODO: redis.set(keySetupCode(code), JSON.stringify({ createdAt: new Date().toISOString() }), { ex: 600 })
  throw new Error("TODO: implement createSetupCode");
}
