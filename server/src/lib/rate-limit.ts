import { redis } from "./redis";

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  const ttl = await redis.ttl(key);
  return {
    success: count <= limit,
    remaining: Math.max(0, limit - count),
    reset: Date.now() + ttl * 1000,
  };
}

// Simple boolean helper for route handlers
export async function isRateLimited(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  const result = await checkRateLimit(key, maxRequests, windowSeconds);
  return !result.success;
}
