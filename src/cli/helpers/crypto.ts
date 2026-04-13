/**
 * Cryptographic helpers for secret generation and hashing.
 */

/**
 * TODO: Generate a cryptographically secure random secret.
 * Used for MASTER_SECRET and TELEGRAM_WEBHOOK_SECRET.
 * Returns a hex string (e.g. 64 chars = 32 bytes).
 */
export function generateSecret(_bytes?: number): string {
  // TODO: use crypto.randomBytes
  throw new Error("TODO: implement generateSecret");
}

/**
 * TODO: Generate a one-time setup code in XXXX-XXXX format.
 * Alphanumeric uppercase, e.g. "ABCD-1234".
 */
export function generateSetupCode(): string {
  // TODO: use crypto.randomBytes, encode as alphanumeric uppercase
  throw new Error("TODO: implement generateSetupCode");
}

/**
 * TODO: Hash a secret using SHA-256 for storage.
 * The master secret is stored hashed in Redis.
 */
export function hashSecret(_secret: string): string {
  // TODO: use crypto.createHash('sha256')
  throw new Error("TODO: implement hashSecret");
}
