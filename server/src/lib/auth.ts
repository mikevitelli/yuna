import { createHash, randomUUID, randomBytes } from "crypto";
import {
  redis,
  keyToken,
  keyDeviceToken,
  keySetupCode,
  KEY_MASTER,
} from "./redis";
import type { DeviceToken } from "./types";

export interface AuthResult {
  device: string;
  registeredAt: string;
}

// ─── Header parsing ──────────────────────────────────────────────────────────

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

// ─── Device token auth ───────────────────────────────────────────────────────

export async function validateDeviceToken(
  request: Request
): Promise<AuthResult | null> {
  const token = extractBearerToken(request);
  if (!token) return null;

  const raw = await redis.get<string | DeviceToken>(keyToken(token));
  if (!raw) return null;

  try {
    const parsed =
      typeof raw === "string" ? (JSON.parse(raw) as DeviceToken) : raw;
    return { device: parsed.device, registeredAt: parsed.registeredAt };
  } catch {
    return null;
  }
}

export async function issueDeviceToken(deviceName: string): Promise<string> {
  // Revoke any existing token for this device first
  await revokeDeviceToken(deviceName);

  const token = randomUUID();
  const record: DeviceToken = {
    token,
    device: deviceName,
    registeredAt: new Date().toISOString(),
  };
  await redis.set(keyToken(token), JSON.stringify(record));
  await redis.set(keyDeviceToken(deviceName), token);
  return token;
}

export async function revokeDeviceToken(deviceName: string): Promise<void> {
  const existingToken = await redis.get<string>(keyDeviceToken(deviceName));
  if (existingToken) {
    await redis.del(keyToken(existingToken));
  }
  await redis.del(keyDeviceToken(deviceName));
}

// ─── Master secret (admin operations) ────────────────────────────────────────

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export async function setMasterSecret(secret: string): Promise<void> {
  await redis.set(KEY_MASTER, hashSecret(secret));
}

export async function validateMasterSecret(secret: string): Promise<boolean> {
  if (!secret) return false;
  const stored = await redis.get<string>(KEY_MASTER);
  if (!stored) return false;
  return hashSecret(secret) === stored;
}

export function validateMasterSecretHeader(
  request: Request
): Promise<boolean> {
  const token = extractBearerToken(request);
  if (!token) return Promise.resolve(false);
  return validateMasterSecret(token);
}

// ─── One-time setup codes ────────────────────────────────────────────────────

const SETUP_CODE_TTL_SECONDS = 600;

export function generateSetupCodeString(): string {
  // 4+4 alphanumeric, readable (no 0/O/I/1 confusion)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
    if (i === 3) code += "-";
  }
  return code;
}

export async function createSetupCode(code: string): Promise<void> {
  await redis.set(
    keySetupCode(code),
    JSON.stringify({ createdAt: new Date().toISOString() }),
    { ex: SETUP_CODE_TTL_SECONDS }
  );
}

export async function validateSetupCode(code: string): Promise<boolean> {
  if (!code) return false;
  const normalized = code.trim().toUpperCase();
  const raw = await redis.get<string>(keySetupCode(normalized));
  if (!raw) return false;
  // Single use — delete after successful validation
  await redis.del(keySetupCode(normalized));
  return true;
}

// ─── Telegram owner lock ─────────────────────────────────────────────────────

export function isOwner(userId: number): boolean {
  const ownerId = process.env.TELEGRAM_OWNER_ID;
  if (!ownerId) return true; // dev mode
  return String(userId) === ownerId;
}
