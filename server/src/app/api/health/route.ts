import { NextResponse } from "next/server";

/**
 * GET /api/health — Server health check.
 * No auth required. Returns server status and Redis connectivity.
 *
 * TODO: Implement:
 * 1. Ping Redis to verify connectivity
 * 2. Return { status: "ok", timestamp, redis: "connected"|"error" }
 * 3. Return 503 if Redis is down
 */
export async function GET(): Promise<NextResponse> {
  // TODO: implement health check
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    // TODO: add redis connectivity check
  });
}
