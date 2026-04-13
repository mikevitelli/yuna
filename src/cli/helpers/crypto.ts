import { randomBytes, createHash } from "crypto";

export function generateSecret(bytes: number = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function generateSetupCode(): string {
  // 4+4 alphanumeric, no ambiguous chars (0/O/I/1)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[buf[i] % chars.length];
    if (i === 3) code += "-";
  }
  return code;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
